import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { WalletAccount } from '@domains/wallet/models/wallet.models';

export type WalletFlowState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'failed';

@Injectable({
  providedIn: 'root',
})
export class WalletFlowFacade {
  private readonly stateSubject = new BehaviorSubject<WalletFlowState>('idle');
  private readonly accountSubject = new BehaviorSubject<
    WalletAccount | undefined
  >(undefined);

  readonly state$: Observable<WalletFlowState> =
    this.stateSubject.asObservable();
  readonly account$: Observable<WalletAccount | undefined> =
    this.accountSubject.asObservable();

  setConnecting(): void {
    this.stateSubject.next('connecting');
  }

  setConnected(account: WalletAccount): void {
    this.accountSubject.next(account);
    this.stateSubject.next('connected');
  }

  setDisconnecting(): void {
    this.stateSubject.next('disconnecting');
  }

  setIdle(): void {
    this.accountSubject.next(undefined);
    this.stateSubject.next('idle');
  }

  setFailed(): void {
    this.stateSubject.next('failed');
  }
}
