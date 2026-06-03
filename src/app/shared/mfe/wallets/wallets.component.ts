import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import {
  WalletConnectionSnapshot,
  WalletsMfeModule,
  WalletsMfeMountApi,
} from '@mfe-contracts/wallet-mfe.types';
import { WalletAccountChangedPayload } from '@mfe-contracts/payloads';
import { AppLoggerService } from '@core/logging/app-logger.service';

@Component({
  selector: 'app-wallets',
  standalone: false,
  template: ` <div #container></div> `,
})
export class WalletsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ElementRef })
  public containerRef!: ElementRef<HTMLElement>;

  private unmountMfe: (() => void) | undefined;
  private unsubscribeEvents: (() => void) | undefined;
  private isDestroyed = false;

  constructor(
    private walletsService: WalletsService,
    private logger: AppLoggerService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    void this.initializeMfe();
  }

  async initializeMfe() {
    const container = this.containerRef?.nativeElement;
    if (!container) {
      this.logger.log('error', 'Wallets MFE: host container is not available');
      return;
    }

    try {
      const mfeModule = (await loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe-wallets',
        exposedModule: './mount',
      })) as WalletsMfeModule;
      this.logger.log('info', 'Wallets MFE: remote module loaded', {
        moduleKeys: Object.keys(mfeModule || {}),
      });
      this.attachRemoteStyles('mfe-wallets', './mount');

      // Prevent mounting if component was destroyed while remote loaded.
      if (this.isDestroyed) {
        return;
      }

      this.unmountMfe?.();
      if (!container || typeof mfeModule.mount !== 'function') {
        throw new Error('MFE mount function is not available');
      }

      const mountResult = mfeModule.mount(container, {
        context: {
          contractVersion: '2.0.0',
          environment: 'dev',
        },
        callbacks: {
          onAccountChanged: (account: WalletAccountChangedPayload) => {
            this.ngZone.run(() => {
              this.walletsService.setAccount(account);
            });
          },
          onCloseRequested: () => {
            this.ngZone.run(() => {
              this.walletsService.requestClose();
            });
          },
        },
      });
      this.unsubscribeEvents?.();
      this.unsubscribeEvents = undefined;

      if (this.isMountApi(mountResult)) {
        this.unmountMfe = mountResult.unmount;
        this.ngZone.run(() => {
          this.applyConnectionSnapshot(mountResult.getSnapshot());
        });
        this.unsubscribeEvents = mountResult.subscribe(event => {
          if (event.type === 'connection.snapshot.updated') {
            this.ngZone.run(() => {
              this.applyConnectionSnapshot(event.payload);
            });
          }
        });
      } else {
        this.unmountMfe =
          typeof mountResult === 'function' ? mountResult : undefined;
      }

      this.logger.log('info', 'Wallets MFE: mounted successfully');
    } catch (error) {
      container.innerHTML =
        '<div style="padding:12px;color:#ef4444;font-size:12px;">Wallets MFE failed to mount. Check browser console.</div>';
      this.logger.log('error', 'Wallets MFE: failed to mount', {
        error,
      });
    }
  }

  private attachRemoteStyles(remoteName: string, exposedModule: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const key = `css__${remoteName}__${exposedModule}`;
    const styles = (window as unknown as Record<string, unknown>)[key];
    if (!Array.isArray(styles)) {
      return;
    }

    for (const href of styles) {
      if (typeof href !== 'string' || href.trim() === '') {
        continue;
      }
      const absoluteHref = new URL(href, document.baseURI).href;
      const alreadyLoaded = Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
      ).some(link => link.href === absoluteHref);
      if (alreadyLoaded) {
        continue;
      }

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = absoluteHref;
      link.dataset['mfeStyle'] = `${remoteName}:${exposedModule}`;
      document.head.appendChild(link);
    }
  }

  private applyConnectionSnapshot(snapshot: WalletConnectionSnapshot): void {
    if (snapshot.account) {
      this.walletsService.setAccount({ account: snapshot.account });
      return;
    }

    this.walletsService.setAccount(undefined);
  }

  private isMountApi(value: unknown): value is WalletsMfeMountApi {
    return (
      typeof value === 'object' &&
      value !== null &&
      'unmount' in value &&
      'subscribe' in value &&
      'getSnapshot' in value
    );
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = undefined;
    this.unmountMfe?.();
    this.unmountMfe = undefined;
  }
}
