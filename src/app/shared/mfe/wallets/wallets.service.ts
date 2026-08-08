import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  LastConnectedWallet,
  WalletAccount,
} from '@domains/wallet/models/wallet.models';
import { ProductEventsService } from '@core/product-events/product-events.service';

const LAST_CONNECTED_STORAGE_KEY = 'cs-host.last-connected-wallet.v1';

function isWalletType(
  value: unknown
): value is LastConnectedWallet['walletType'] {
  return value === 'embedded' || value === 'external';
}

function parseLastConnected(
  raw: string | null
): LastConnectedWallet | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('account' in parsed) ||
      typeof (parsed as { account: unknown }).account !== 'string'
    ) {
      return undefined;
    }

    const account = (parsed as { account: string }).account;
    if (!account) {
      return undefined;
    }

    const chainIdValue = (parsed as { chainId?: unknown }).chainId;
    const chainId =
      typeof chainIdValue === 'number'
        ? chainIdValue
        : chainIdValue === null
          ? null
          : null;
    const walletTypeValue = (parsed as { walletType?: unknown }).walletType;
    const walletType = isWalletType(walletTypeValue)
      ? walletTypeValue
      : 'external';
    const sourceValue = (parsed as { source?: unknown }).source;
    const connectorIdValue = (parsed as { connectorId?: unknown }).connectorId;

    return {
      account,
      chainId,
      walletType,
      source: typeof sourceValue === 'string' ? sourceValue : undefined,
      connectorId:
        typeof connectorIdValue === 'string' ? connectorIdValue : undefined,
    };
  } catch {
    return undefined;
  }
}

@Injectable({
  providedIn: 'root',
})
export class WalletsService {
  public provider = new BehaviorSubject<unknown | undefined>(undefined);
  public account = new BehaviorSubject<WalletAccount | undefined>(undefined);
  public lastConnected = new BehaviorSubject<LastConnectedWallet | undefined>(
    parseLastConnected(
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem(LAST_CONNECTED_STORAGE_KEY)
        : null
    )
  );
  public closeRequested = new BehaviorSubject<boolean>(false);
  public openRequested = new BehaviorSubject<boolean>(false);

  constructor(private readonly productEvents: ProductEventsService) {}

  setAccount(account: WalletAccount | undefined): void {
    this.account.next(account);
  }

  rememberConnectedWallet(wallet: LastConnectedWallet): void {
    this.lastConnected.next(wallet);
    try {
      window.sessionStorage.setItem(
        LAST_CONNECTED_STORAGE_KEY,
        JSON.stringify(wallet)
      );
    } catch (error) {
      this.productEvents.recordFailure('wallet.last_connected.persist', error, {
        metadata: {
          action: 'set',
          storage: 'sessionStorage',
          walletType: wallet.walletType,
          connectorId: wallet.connectorId,
        },
      });
    }
  }

  clearLastConnectedWallet(): void {
    this.lastConnected.next(undefined);
    try {
      window.sessionStorage.removeItem(LAST_CONNECTED_STORAGE_KEY);
    } catch (error) {
      this.productEvents.recordFailure('wallet.last_connected.persist', error, {
        metadata: {
          action: 'clear',
          storage: 'sessionStorage',
        },
      });
    }
  }

  requestClose(): void {
    this.closeRequested.next(true);
  }

  clearCloseRequest(): void {
    this.closeRequested.next(false);
  }

  requestOpen(): void {
    this.openRequested.next(true);
  }

  clearOpenRequest(): void {
    this.openRequested.next(false);
  }
}
