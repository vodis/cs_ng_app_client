import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import { WalletsMfeModule } from '@mfe-contracts/wallet-mfe.types';
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
  private isDestroyed = false;

  constructor(
    private walletsService: WalletsService,
    private logger: AppLoggerService
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
          onAccountChanged: (account: WalletAccountChangedPayload) => {
            this.walletsService.setAccount(account);
          },
          onCloseRequested: () => {
            this.walletsService.requestClose();
          },
        },
      });
      this.unmountMfe = typeof unmount === 'function' ? unmount : undefined;
      this.logger.log('info', 'Wallets MFE: mounted successfully');
    } catch (error) {
      container.innerHTML =
        '<div style="padding:12px;color:#ef4444;font-size:12px;">Wallets MFE failed to mount. Check browser console.</div>';
      this.logger.log('error', 'Wallets MFE: failed to mount', {
        error,
      });
    }
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unmountMfe?.();
    this.unmountMfe = undefined;
  }
}
