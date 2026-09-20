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
import {
  IDLE_WALLET_BALANCES_SNAPSHOT,
  type WalletBalancesSnapshot,
} from '@mfe-contracts/wallet-balances.types';
import { AppLoggerService } from '@core/logging/app-logger.service';
import type {
  SwapReviewDepositRequest,
  SwapReviewIntent,
} from '@mfe-contracts/swap-review.types';

const SIGNATURE_WAIT_MS = 120_000;

const WALLET_SESSION_STORAGE_KEY = 'mfe-wallets.session.v1';

const DISCONNECTED_SNAPSHOT: WalletConnectionSnapshot = {
  status: 'disconnected',
  account: null,
  chainId: null,
  identity: null,
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
  private readonly balancesSubject =
    new BehaviorSubject<WalletBalancesSnapshot>(IDLE_WALLET_BALANCES_SNAPSHOT);
  private pendingSignature?: {
    resolve: (signature: DefuseWalletSignatureResult) => void;
    reject: (error: WalletExecutionFailure) => void;
  };
  private pendingTransaction?: {
    resolve: (hash: string) => void;
    reject: (error: WalletExecutionFailure) => void;
  };

  readonly snapshot$: Observable<WalletConnectionSnapshot | undefined> =
    this.snapshotSubject.asObservable();
  /** @deprecated Use ConnectedWalletBalancesFacade for product balance reads. */
  readonly balances$: Observable<WalletBalancesSnapshot> =
    this.balancesSubject.asObservable();

  constructor(private readonly logger: AppLoggerService) {}

  registerMountApi(api: WalletsMfeMountApi): void {
    this.mountApi = api;
    this.snapshotSubject.next(api.getSnapshot());
  }

  clearMountApi(): void {
    this.mountApi = undefined;
    this.balancesSubject.next(IDLE_WALLET_BALANCES_SNAPSHOT);
    this.rejectPendingSignature({
      code: 'GATEWAY_UNAVAILABLE',
      message: 'Wallet gateway unmounted',
      retryable: true,
    });
    this.rejectPendingTransaction({
      code: 'GATEWAY_UNAVAILABLE',
      message: 'Wallet gateway unmounted',
      retryable: true,
    });
  }

  updateSnapshot(snapshot: WalletConnectionSnapshot): void {
    this.snapshotSubject.next(snapshot);
    if (snapshot.status !== 'connected' || !snapshot.account) {
      this.balancesSubject.next(IDLE_WALLET_BALANCES_SNAPSHOT);
    }
  }

  updateBalances(snapshot: WalletBalancesSnapshot): void {
    if (this.snapshotSubject.value?.status !== 'connected') {
      this.balancesSubject.next(IDLE_WALLET_BALANCES_SNAPSHOT);
      return;
    }
    this.balancesSubject.next(snapshot);
  }

  /** @deprecated Balance requests are owned by the authenticated host API layer. */
  requestBalancesSync(chainId?: number): void {
    if (!this.canSendGatewayEvent()) {
      return;
    }
    this.sendGatewayEvent({ type: 'BALANCES_SYNC_REQUESTED', chainId });
  }

  handleExecutionStateChanged(payload: {
    state: string;
    reason?: string;
    errorCode?: string;
  }): void {
    if (payload.state.endsWith('signRejected')) {
      const error = this.executionFailure(
        'SIGN_REJECTED',
        payload.reason ?? 'Wallet action was cancelled',
        true
      );
      this.rejectPendingSignature(error);
      this.rejectPendingTransaction(error);
      return;
    }

    if (payload.state.endsWith('signFailed')) {
      const error = this.executionFailure(
        'SIGN_FAILED',
        payload.reason ?? 'Wallet submission failed',
        true
      );
      this.rejectPendingSignature(error);
      this.rejectPendingTransaction(error);
    }
  }

  handleIntentSigned(payload: { signature: Record<string, unknown> }): void {
    if (!this.pendingSignature) {
      return;
    }

    this.pendingSignature.resolve(payload.signature);
    this.pendingSignature = undefined;
  }

  handleTransactionSubmitted(payload: { hash: string }): void {
    if (!this.pendingTransaction) {
      return;
    }
    this.pendingTransaction.resolve(payload.hash);
    this.pendingTransaction = undefined;
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

  async runNearDepositFlow(
    input: SwapReviewDepositRequest
  ): Promise<{ transactionHash: string }> {
    const snapshot = this.requireSnapshot();
    if (!snapshot.account || snapshot.account !== input.senderAccount) {
      throw this.executionFailure(
        'NOT_CONNECTED',
        'Connected NEAR wallet does not match the swap sender',
        false
      );
    }
    if (!snapshot.isVerified) {
      this.sendGatewayEvent({ type: 'VERIFY_REQUESTED' });
      throw this.executionFailure(
        'NOT_VERIFIED',
        'Complete wallet verification before depositing',
        true
      );
    }

    this.sendGatewayEvent({
      type: 'PREPARE_REQUESTED',
      payload: {
        from: input.senderAccount,
        to: input.depositAddress,
        value: input.amount,
      },
    });
    await this.waitForExecutionState('operating.awaitingSign', input.traceId);

    const transaction = this.waitForTransactionSubmission(input.traceId);
    this.sendGatewayEvent({ type: 'SIGN_REQUESTED' });
    return { transactionHash: await transaction };
  }

  abortExecution(): void {
    this.sendGatewayEvent({ type: 'ABORT' });
    this.rejectPendingSignature({
      code: 'SIGN_FAILED',
      message: 'Swap signing aborted',
      retryable: true,
    });
  }

  resetConnection(): void {
    if (!this.canSendGatewayEvent()) {
      return;
    }
    this.sendGatewayEvent({ type: 'RESET' });
  }

  disconnectWallet(): void {
    const disconnect = this.mountApi?.disconnectWallet;
    if (disconnect) {
      disconnect();
    } else {
      window.localStorage.removeItem(WALLET_SESSION_STORAGE_KEY);
    }

    this.snapshotSubject.next(DISCONNECTED_SNAPSHOT);
    this.balancesSubject.next(IDLE_WALLET_BALANCES_SNAPSHOT);
  }

  openSwapReview(intent: SwapReviewIntent): void {
    const open = this.mountApi?.openSwapReview;
    if (!open) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Swap review is not available in the loaded wallet remote',
        true
      );
    }
    open(intent);
  }

  closeSwapReview(): void {
    this.mountApi?.closeSwapReview?.();
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

  async syncConnectedWallet(): Promise<WalletConnectionSnapshot> {
    const snapshot = this.snapshotSubject.value ?? this.mountApi?.getSnapshot();
    if (snapshot?.account) {
      return snapshot;
    }

    const syncConnectedWallet = this.mountApi?.syncConnectedWallet;
    if (!syncConnectedWallet) {
      throw this.executionFailure(
        'GATEWAY_UNAVAILABLE',
        'Wallet connection sync is not available',
        true
      );
    }

    const nextSnapshot = await syncConnectedWallet();
    this.snapshotSubject.next(nextSnapshot);
    return nextSnapshot;
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

  private waitForTransactionSubmission(traceId: string): Promise<string> {
    if (this.pendingTransaction) {
      throw this.executionFailure(
        'SUBMIT_FAILED',
        'Another wallet transaction is already in progress',
        false
      );
    }

    return new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        this.pendingTransaction = undefined;
        reject(
          this.executionFailure(
            'SUBMIT_FAILED',
            'Timed out waiting for wallet transaction',
            true
          )
        );
      }, SIGNATURE_WAIT_MS);

      this.pendingTransaction = {
        resolve: hash => {
          window.clearTimeout(timer);
          this.logger.log('info', 'Wallet gateway: deposit submitted', {
            flowName: 'swap',
            step: 'deposit_submitted',
            traceId,
          });
          resolve(hash);
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

  private rejectPendingTransaction(error: WalletExecutionFailure): void {
    if (!this.pendingTransaction) {
      return;
    }
    this.pendingTransaction.reject(error);
    this.pendingTransaction = undefined;
  }

  private executionFailure(
    code: WalletExecutionFailure['code'],
    message: string,
    retryable: boolean
  ): WalletExecutionFailure {
    return { code, message, retryable };
  }
}
