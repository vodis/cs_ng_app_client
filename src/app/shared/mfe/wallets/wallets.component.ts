import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';

type WalletsMfeModule = {
  mount: (
    container: HTMLElement,
    props?: {
      context?: {
        contractVersion?: '2.0.0';
        sessionId?: string;
        locale?: string;
        theme?: 'light' | 'dark';
        environment?: 'dev' | 'staging' | 'prod';
      };
      callbacks?: {
        onAccountChanged?: (payload: { account: string }) => void;
        onCloseRequested?: () => void;
      };
    }
  ) => (() => void) | void;
};

@Component({
  selector: 'app-wallets',
  standalone: false,
  template: ` <div #container></div> `,
})
export class WalletsComponent implements AfterViewInit, OnDestroy {
  @ViewChild('container', { read: ElementRef })
  public containerRef!: ElementRef<HTMLElement>;

  private unmountMfe: (() => void) | undefined;
  private isDestroyed = false;

  constructor(private walletsService: WalletsService) {}

  ngAfterViewInit() {
    void this.initializeMfe();
  }

  async initializeMfe() {
    const container = this.containerRef?.nativeElement;
    if (!container) {
      console.error('Wallets MFE: host container is not available');
      return;
    }

    try {
      const mfeModule = (await loadRemoteModule({
        type: 'manifest',
        remoteName: 'mfe-wallets',
        exposedModule: './mount',
      })) as WalletsMfeModule;
      console.info(
        'Wallets MFE: remote module loaded',
        Object.keys(mfeModule || {})
      );

      // Prevent mounting if component was destroyed while remote loaded.
      if (this.isDestroyed) {
        return;
      }

      this.unmountMfe?.();
      if (!container || typeof mfeModule.mount !== 'function') {
        throw new Error('MFE mount function is not available');
      }

      const unmount = mfeModule.mount(container, {
        context: {
          contractVersion: '2.0.0',
          environment: 'dev',
        },
        callbacks: {
          onAccountChanged: (account: { account: string }) => {
            this.walletsService.account.next(account);
          },
          onCloseRequested: () => {
            this.walletsService.closeRequested.next(true);
          },
        },
      });
      this.unmountMfe = typeof unmount === 'function' ? unmount : undefined;
      console.info('Wallets MFE: mounted successfully');
    } catch (error) {
      container.innerHTML =
        '<div style="padding:12px;color:#ef4444;font-size:12px;">Wallets MFE failed to mount. Check browser console.</div>';
      console.error('Error loading MFE component:', error);
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unmountMfe?.();
    this.unmountMfe = undefined;
  }
}
