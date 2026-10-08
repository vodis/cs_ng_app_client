import {
  combineLatest,
  distinctUntilChanged,
  map,
  Subscription,
  fromEvent,
  takeUntil,
} from 'rxjs';
import {
  Component,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { loadRemoteModule } from '@angular-architects/module-federation';
import { firstValueFrom } from 'rxjs';
import { WalletsService } from '@shared/mfe/wallets/wallets.service';
import {
  WalletConnectionSnapshot,
  WalletSelection,
  WalletsMfeModule,
  WalletsMfeMountApi,
} from '@mfe-contracts/wallet-mfe.types';
import {
  WALLET_REMOTE_EXPOSED_MODULES,
  WALLET_REMOTE_NAME,
} from '@mfe-contracts/wallet-remote-entrypoints';
import { WalletAccountChangedPayload } from '@mfe-contracts/payloads';
import { AppLoggerService } from '@core/logging/app-logger.service';
import { AuthSessionService } from '@core/auth/auth-session.service';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import { environment } from '../../../../environments/environment';
import { SwapApiClient } from '@domains/exchange/data-access/swap-api.client';
import { IntentRelayService } from '@domains/exchange/data-access/intent-relay.service';
import type {
  SwapReviewPrepareRequest,
  SwapReviewPrepareResult,
} from '@mfe-contracts/swap-review.types';

@Component({
  selector: 'app-wallets',
  standalone: false,
  template: ` <div #container class="wallets-host"></div> `,
  styleUrls: ['wallets.component.scss'],
})
export class WalletsComponent implements AfterViewInit, OnDestroy {
  @Output() readonly dialogCloseReady = new EventEmitter<boolean>();
  @ViewChild('container', { read: ElementRef })
  public containerRef!: ElementRef<HTMLElement>;

  private selectionSubscription?: Subscription;
  private unmountMfe: (() => void) | undefined;
  private unsubscribeEvents: (() => void) | undefined;
  private isDestroyed = false;
  private readonly remoteName = WALLET_REMOTE_NAME;
  private activeSwapPreparation?: { id: string; traceId: string };

  constructor(
    private walletsService: WalletsService,
    private walletGatewayBridge: WalletGatewayBridgeService,
    private authSession: AuthSessionService,
    private swapApi: SwapApiClient,
    private intentRelay: IntentRelayService,
    private logger: AppLoggerService,
    private ngZone: NgZone
  ) {}

  ngAfterViewInit() {
    void this.initializeMfe();
  }

  async initializeMfe() {
    this.dialogCloseReady.emit(false);
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
        exposedModule: WALLET_REMOTE_EXPOSED_MODULES.mount,
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

      this.selectionSubscription?.unsubscribe();
      this.unmountMfe?.();
      if (!container || typeof mfeModule.mount !== 'function') {
        throw new Error('MFE mount function is not available');
      }

      const mountResult = this.ngZone.runOutsideAngular(() =>
        mfeModule.mount(container, {
          context: {
            contractVersion: '2.3.0',
            selection: this.walletSelection(),
            apiBaseUrl: environment.apiUrl,
            environment: this.mfeEnvironment(),
          },
          callbacks: {
            onAccountChanged: (account: WalletAccountChangedPayload) => {
              this.ngZone.run(() => {
                this.walletsService.setAccount({
                  account: account.account,
                  chainId: this.walletsService.account.value?.chainId ?? null,
                });
                this.walletsService.rememberConnectedWallet({
                  account: account.account,
                  chainId: this.walletsService.account.value?.chainId ?? null,
                  walletType:
                    this.walletsService.lastConnected.value?.walletType ??
                    'external',
                  source: this.walletsService.lastConnected.value?.source,
                  connectorId:
                    this.walletsService.lastConnected.value?.connectorId,
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
            onTransactionSubmitted: payload => {
              this.ngZone.run(() => {
                this.walletGatewayBridge.handleTransactionSubmitted(payload);
              });
            },
            onSwapSettled: payload => {
              this.ngZone.run(() =>
                this.walletsService.publishSwapSettled(payload)
              );
            },
            onSwapSubmitted: payload => {
              this.ngZone.run(() => {
                this.walletsService.publishSwapSubmitted(payload);
              });
            },
            onSwapPreviewRefreshRequested: payload => {
              this.ngZone.run(() => {
                this.walletsService.requestSwapPreviewRefresh(payload.traceId);
                this.walletsService.requestClose();
              });
            },
          },
          services: {
            walletFundingVersion: '1.0.0',
            quoteSwap: (request, options) => {
              options.signal.throwIfAborted();
              return firstValueFrom(
                this.swapApi
                  .requestQuotePreview(request)
                  .pipe(takeUntil(fromEvent(options.signal, 'abort')))
              );
            },
            prepareSwap: (request, options) =>
              this.prepareSwap(request, options.signal),
            signSwap: input =>
              this.walletGatewayBridge.runIntentSignFlow(input),
            depositSwap: request =>
              this.walletGatewayBridge.runWalletDepositFlow(request),
            submitSwap: async request => ({
              intentHash: await this.intentRelay.submitIntent({
                traceId: request.traceId,
                providerId: request.providerId,
                executionMode:
                  request.executionMode === 'intent_sign'
                    ? 'intent_sign'
                    : undefined,
                executionPayload: request.executionPayload,
                signature: request.signature,
                quoteHashes: request.quoteHashes,
                user: {
                  userAddress: request.userAddress,
                  userChainType: request.userChainType,
                },
              }),
            }),
            checkSwapStatus: preparationId => {
              const preparation = this.activeSwapPreparation;
              if (preparation?.id !== preparationId) {
                return Promise.reject(
                  new Error('Swap preparation is no longer active')
                );
              }
              return firstValueFrom(
                this.swapApi.getSwapStatus(preparationId, preparation.traceId)
              );
            },
          },
        })
      );
      this.unsubscribeEvents?.();
      this.unsubscribeEvents = undefined;

      if (this.isMountApi(mountResult)) {
        this.unmountMfe = mountResult.unmount;
        if (
          mountResult.selectionContractVersion !== '1.0.0' ||
          !mountResult.updateSelection
        ) {
          mountResult.unmount();
          this.unmountMfe = undefined;
          throw new Error(
            'Update the wallet remote to restore your selected wallet.'
          );
        }
        this.selectionSubscription = combineLatest([
          this.authSession.session$,
          this.authSession.restored$,
        ])
          .pipe(
            map(() => this.walletSelection()),
            distinctUntilChanged(
              (a, b) => JSON.stringify(a) === JSON.stringify(b)
            )
          )
          .subscribe(selection =>
            this.ngZone.runOutsideAngular(() =>
              mountResult.updateSelection?.(selection)
            )
          );
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

      this.dialogCloseReady.emit(
        this.isMountApi(mountResult) &&
          mountResult.dialogCloseVersion === '1.0.0'
      );
      this.logger.log('info', 'Wallets MFE: mounted successfully');
    } catch (error) {
      this.dialogCloseReady.emit(false);
      container.innerHTML =
        '<div style="padding:12px;color:#ef4444;font-size:12px;" role="alert">Update the wallet remote or retry to restore your selected wallet.</div>';
      this.logger.log('error', 'Wallets MFE: failed to mount', {
        component: 'WalletsComponent',
        action: 'loadAndMount',
        remoteName: this.remoteName,
        errorMessage: this.errorMessage(error),
      });
    }
  }

  private walletSelection(): WalletSelection {
    const session = this.authSession.session;
    if (!session)
      return {
        status: this.authSession.sessionRestored
          ? 'unauthenticated'
          : 'pending',
      };
    const wallet = session.wallets.find(
      item =>
        item.isPrimary &&
        !item.deletedAt &&
        (!item.status || item.status === 'active')
    );
    return {
      status: 'authenticated',
      userId: session.user.id,
      wallet: wallet
        ? {
            id: wallet.id,
            address: wallet.address,
            chainType: wallet.chainType,
            walletType: wallet.walletType,
            source: wallet.source,
          }
        : null,
    };
  }

  private applyConnectionSnapshot(snapshot: WalletConnectionSnapshot): void {
    if (snapshot.account) {
      this.walletsService.setAccount({
        account: snapshot.account,
        chainId: snapshot.chainId,
        identity: snapshot.identity,
      });
      this.walletsService.rememberConnectedWallet({
        account: snapshot.account,
        chainId: snapshot.chainId,
        walletType: snapshot.identity?.walletType ?? 'external',
        source: snapshot.identity?.connectorId,
        connectorId: snapshot.identity?.connectorId,
      });
      this.refreshBackendWallets();
      return;
    }

    this.walletsService.setAccount(undefined);
  }

  private prepareSwap(
    request: SwapReviewPrepareRequest,
    signal: AbortSignal
  ): Promise<SwapReviewPrepareResult> {
    if (signal.aborted) {
      return Promise.reject(
        new DOMException('Swap preparation cancelled', 'AbortError')
      );
    }

    return new Promise((resolve, reject) => {
      const subscription = this.swapApi
        .requestApprovedPreparePackage(request)
        .subscribe({
          next: result => {
            const preparationId =
              result.executionPackage.payload['preparationId'];
            this.activeSwapPreparation =
              typeof preparationId === 'string'
                ? { id: preparationId, traceId: request.traceId }
                : undefined;
            resolve({
              prepareRequest: result,
              providerId: result.providerId,
              executionMode: result.executionPackage.mode,
              amountIn: result.amountIn,
              amountOut: result.amountOut,
              quoteExpiration: result.quoteExpiration,
            });
          },
          error: reject,
        });

      signal.addEventListener(
        'abort',
        () => {
          subscription.unsubscribe();
          reject(new DOMException('Swap preparation cancelled', 'AbortError'));
        },
        { once: true }
      );
    });
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

  private mfeEnvironment(): 'dev' | 'staging' | 'prod' {
    if (environment.name === 'staging') {
      return 'staging';
    }
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
    this.dialogCloseReady.emit(false);
    this.isDestroyed = true;
    this.selectionSubscription?.unsubscribe();
    this.unsubscribeEvents?.();
    this.unsubscribeEvents = undefined;
    this.walletGatewayBridge.clearMountApi();
    this.unmountMfe?.();
    this.unmountMfe = undefined;
  }
}
