import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  filter,
  firstValueFrom,
  timeout,
} from 'rxjs';
import type { ApprovedIntentPrepareRequest } from '@mfe-contracts/intent-prepare.contract';
import type { WalletGatewayEvent } from '@mfe-contracts/gateway-events';
import type {
  DefuseWalletSignatureResult,
  WalletExecutionFailure,
} from '@mfe-contracts/wallet-execution.types';
import type {
  WalletConnectionSnapshot,
  WalletOnboardingResult,
  WalletsMfeMountApi,
} from '@mfe-contracts/wallet-mfe.types';
import { AppLoggerService } from '@core/logging/app-logger.service';

const SIGNATURE_WAIT_MS = 120_000;

const WALLET_SESSION_STORAGE_KEY = 'mfe-wallets.session.v1';

const DISCONNECTED_SNAPSHOT: WalletConnectionSnapshot = {
  status: 'disconnected',
  account: null,
  chainId: null,
  isVerified: false,
  safetyStatus: null,
  isBypassed: false,
  executionState: 'operating.idle',
};

@Injectable({
  providedIn: 'root',
})
export class WalletGatewayBridgeService {
  private mountApi?: WalletsMfeMountApi;
  private readonly snapshotSubject = new BehaviorSubject<
    WalletConnectionSnapshot | undefined
  >(undefined);
  private pendingSignature?: {
    resolve: (signature: DefuseWalletSignatureResult) => void;
    reject: (error: WalletExecutionFailure) => void;
  };

  readonly snapshot$: Observable<WalletConnectionSnapshot | undefined> =
    this.snapshotSubject.asObservable();

  constructor(private readonly logger: AppLoggerService) {}

  registerMountApi(api: WalletsMfeMountApi): void {
    this.mountApi = api;
    this.snapshotSubject.next(api.getSnapshot());
  }

  clearMountApi(): void {
    this.mountApi = undefined;
    this.rejectPendingSignature({
      code: 'GATEWAY_UNAVAILABLE',
      message: 'Wallet gateway unmounted',
      retryable: true,
    });
  }

  updateSnapshot(snapshot: WalletConnectionSnapshot): void {
    this.snapshotSubject.next(snapshot);
  }

  handleExecutionStateChanged(payload: {
    state: string;
    reason?: string;
    errorCode?: string;
  }): void {
    if (payload.state.endsWith('signRejected')) {
      this.rejectPendingSignature({
        code: 'SIGN_REJECTED',
        message: payload.reason ?? 'Wallet action was cancelled',
        retryable: true,
      });
      return;
    }

    if (payload.state.endsWith('signFailed')) {
      this.rejectPendingSignature({
        code: 'SIGN_FAILED',
        message: payload.reason ?? 'Intent signature failed',
        retryable: true,
      });
    }
  }

  handleIntentSigned(payload: { signature: Record<string, unknown> }): void {
    if (!this.pendingSignature) {
      return;
    }

    this.pendingSignature.resolve(payload.signature);
    this.pendingSignature = undefined;
  }

  async runIntentSignFlow(input: {
    traceId: string;
    prepareRequest: ApprovedIntentPrepareRequest;
  }): Promise<DefuseWalletSignatureResult> {
    const snapshot = this.requireSnapshot();

    if (!snapshot.account) {
      throw this.executionFailure(
        'NOT_CONNECTED',
        'Connect wallet first',
        false
      );
    }

    if (!snapshot.isVerified) {
      this.sendGatewayEvent({ type: 'VERIFY_REQUESTED' });
      throw this.executionFailure(
        'NOT_VERIFIED',
        'Complete wallet verification before signing',
        true
      );
    }

    if (!this.canSendGatewayEvent()) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Wallet gateway is not ready for intent signing',
        true
      );
    }

    this.logger.log('info', 'Wallet gateway: prepare intent message', {
      flowName: 'swap',
      step: 'prepare_intent_message',
      traceId: input.traceId,
    });

    this.sendGatewayEvent({
      type: 'PREPARE_INTENT_MESSAGE_REQUESTED',
      request: input.prepareRequest,
    });

    await this.waitForExecutionState(
      'operating.awaitingIntentSign',
      input.traceId
    );

    this.logger.log('info', 'Wallet gateway: sign requested', {
      flowName: 'swap',
      step: 'sign_requested',
      traceId: input.traceId,
    });

    this.sendGatewayEvent({ type: 'SIGN_REQUESTED' });

    return this.waitForIntentSignature(input.traceId);
  }

  abortExecution(): void {
    this.sendGatewayEvent({ type: 'ABORT' });
    this.rejectPendingSignature({
      code: 'SIGN_FAILED',
      message: 'Swap signing aborted',
      retryable: true,
    });
  }

  disconnectWallet(): void {
    const disconnect = this.mountApi?.disconnectWallet;
    if (disconnect) {
      disconnect();
    } else {
      window.localStorage.removeItem(WALLET_SESSION_STORAGE_KEY);
    }

    this.snapshotSubject.next(DISCONNECTED_SNAPSHOT);
  }

  async createEmbeddedWallet(): Promise<WalletOnboardingResult> {
    const createEmbeddedWallet = this.mountApi?.createEmbeddedWallet;
    if (!createEmbeddedWallet) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Embedded wallet creation is not available',
        true
      );
    }

    return createEmbeddedWallet();
  }

  private canSendGatewayEvent(): boolean {
    return typeof this.mountApi?.sendGatewayEvent === 'function';
  }

  private sendGatewayEvent(event: WalletGatewayEvent): void {
    const send = this.mountApi?.sendGatewayEvent;
    if (!send) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Wallet MFE does not expose sendGatewayEvent yet',
        true
      );
    }

    send(event);
  }

  private requireSnapshot(): WalletConnectionSnapshot {
    const snapshot = this.snapshotSubject.value ?? this.mountApi?.getSnapshot();
    if (!snapshot) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Wallet connection snapshot is unavailable',
        true
      );
    }

    return snapshot;
  }

  private waitForExecutionState(state: string, traceId: string): Promise<void> {
    return firstValueFrom(
      this.snapshot$.pipe(
        filter(
          (snapshot): snapshot is WalletConnectionSnapshot =>
            snapshot?.executionState === state
        ),
        timeout({
          each: SIGNATURE_WAIT_MS,
          with: () => {
            throw this.executionFailure(
              'PREPARE_FAILED',
              `Timed out waiting for wallet state ${state}`,
              true
            );
          },
        })
      )
    ).then(() => {
      this.logger.log('info', 'Wallet gateway: execution state reached', {
        flowName: 'swap',
        step: state,
        traceId,
      });
    });
  }

  private waitForIntentSignature(
    traceId: string
  ): Promise<DefuseWalletSignatureResult> {
    if (this.pendingSignature) {
      throw this.executionFailure(
        'SIGN_FAILED',
        'Another wallet signature is already in progress',
        false
      );
    }

    return new Promise<DefuseWalletSignatureResult>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingSignature = undefined;
        reject(
          this.executionFailure(
            'SIGN_FAILED',
            'Timed out waiting for wallet signature',
            true
          )
        );
      }, SIGNATURE_WAIT_MS);

      this.pendingSignature = {
        resolve: signature => {
          window.clearTimeout(timer);
          this.logger.log('info', 'Wallet gateway: intent signed', {
            flowName: 'swap',
            step: 'intent_signed',
            traceId,
          });
          resolve(signature);
        },
        reject: error => {
          window.clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  private rejectPendingSignature(error: WalletExecutionFailure): void {
    if (!this.pendingSignature) {
      return;
    }

    this.pendingSignature.reject(error);
    this.pendingSignature = undefined;
  }

  private executionFailure(
    code: WalletExecutionFailure['code'],
    message: string,
    retryable: boolean
  ): WalletExecutionFailure {
    return { code, message, retryable };
  }
}
