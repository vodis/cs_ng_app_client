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
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { environment } from '../../../../environments/environment';

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
  private readonly remoteName = 'mfe-wallets';

  constructor(
    private walletsService: WalletsService,
    private walletGatewayBridge: WalletGatewayBridgeService,
    private authSession: AuthSessionService,
    private logger: AppLoggerService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    void this.initializeMfe();
  }

  async initializeMfe() {
    const container = this.containerRef?.nativeElement;
    if (!container) {
      this.logger.log('error', 'Wallets MFE: host container is not available', {
        component: 'WalletsComponent',
        action: 'resolveContainer',
        remoteName: this.remoteName,
      });
      return;
    }

    try {
      const mfeModule = (await loadRemoteModule({
        type: 'manifest',
        remoteName: this.remoteName,
        exposedModule: './mount',
      })) as WalletsMfeModule;
      this.logger.log('info', 'Wallets MFE: remote module loaded', {
        component: 'WalletsComponent',
        action: 'loadRemoteModule',
        remoteName: this.remoteName,
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

      const mountResult = mfeModule.mount(container, {
        context: {
          contractVersion: '2.0.0',
          environment: this.mfeEnvironment(),
        },
        callbacks: {
          onAccountChanged: (account: WalletAccountChangedPayload) => {
            this.ngZone.run(() => {
              this.walletsService.setAccount({
                account: account.account,
                chainId: this.walletsService.account.value?.chainId ?? null,
              });
              this.refreshBackendWallets();
            });
          },
          onCloseRequested: () => {
            this.ngZone.run(() => {
              this.walletsService.requestClose();
            });
          },
          onExecutionStateChanged: payload => {
            this.ngZone.run(() => {
              this.walletGatewayBridge.handleExecutionStateChanged(payload);
            });
          },
          onIntentSigned: payload => {
            this.ngZone.run(() => {
              this.walletGatewayBridge.handleIntentSigned(payload);
            });
          },
        },
      });
      this.unsubscribeEvents?.();
      this.unsubscribeEvents = undefined;

      if (this.isMountApi(mountResult)) {
        this.unmountMfe = mountResult.unmount;
        this.ngZone.run(() => {
          this.walletGatewayBridge.registerMountApi(mountResult);
          this.applyConnectionSnapshot(mountResult.getSnapshot());
        });
        this.unsubscribeEvents = mountResult.subscribe(event => {
          if (event.type === 'connection.snapshot.updated') {
            this.ngZone.run(() => {
              this.walletGatewayBridge.updateSnapshot(event.payload);
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
        '<div style="padding:12px;color:#ef4444;font-size:12px;" role="alert">Wallet connection is temporarily unavailable.</div>';
      this.logger.log('error', 'Wallets MFE: failed to mount', {
        component: 'WalletsComponent',
        action: 'loadAndMount',
        remoteName: this.remoteName,
        errorMessage: this.errorMessage(error),
      });
    }
  }

  private applyConnectionSnapshot(snapshot: WalletConnectionSnapshot): void {
    if (snapshot.account) {
      this.walletsService.setAccount({
        account: snapshot.account,
        chainId: snapshot.chainId,
      });
      this.refreshBackendWallets();
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

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private mfeEnvironment(): 'dev' | 'prod' {
    return environment.production ? 'prod' : 'dev';
  }

  private refreshBackendWallets(): void {
    if (!this.authSession.session) {
      return;
    }

    void this.authSession.reloadWallets().catch(error => {
      this.logger.log('warn', 'Wallets MFE: backend wallet refresh failed', {
        component: 'WalletsComponent',
        action: 'refreshBackendWallets',
        errorMessage: this.errorMessage(error),
      });
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = undefined;
    this.walletGatewayBridge.clearMountApi();
    this.unmountMfe?.();
    this.unmountMfe = undefined;
  }
}
