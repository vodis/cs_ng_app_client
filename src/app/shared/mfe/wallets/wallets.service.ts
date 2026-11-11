import type { SwapSettlementResult } from '@mfe-contracts/swap-review.types';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import {
  LastConnectedWallet,
  WalletAccount,
} from '@domains/wallet/models/wallet.models';
export type WalletDrawerMode = 'wallet' | 'connect' | 'swap-review';
import { ProductEventsService } from '@core/product-events/product-events.service';

/** Legacy unscoped key — removed on hydrate/clear so prior tabs cannot leak. */
const LAST_CONNECTED_STORAGE_KEY_V1 = 'cs-host.last-connected-wallet.v1';
const LAST_CONNECTED_STORAGE_KEY_PREFIX = 'cs-host.last-connected-wallet.v2:';

function storageKeyForUser(userId: string): string {
  return `${LAST_CONNECTED_STORAGE_KEY_PREFIX}${userId}`;
}

function isWalletType(
  value: unknown
): value is LastConnectedWallet['walletType'] {
  return value === 'embedded' || value === 'external';
}

function parseLastConnected(
  raw: string | null,
  expectedUserId?: string
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

    const userIdValue = (parsed as { userId?: unknown }).userId;
    const userId = typeof userIdValue === 'string' ? userIdValue : undefined;
    if (expectedUserId && userId !== expectedUserId) {
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
      userId,
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
  /** Starts empty — hydrate only after the authenticated user id is known. */
  public lastConnected = new BehaviorSubject<LastConnectedWallet | undefined>(
    undefined
  );
  public closeRequested = new BehaviorSubject<boolean>(false);
  public openRequested = new BehaviorSubject<boolean>(false);
  public drawerMode = new BehaviorSubject<WalletDrawerMode>('wallet');
  public swapSettled = new Subject<SwapSettlementResult>();
  public swapSubmitted = new BehaviorSubject<
    { traceId: string; intentHash: string } | undefined
  >(undefined);
  public swapPreviewRefreshRequested = new BehaviorSubject<string | undefined>(
    undefined
  );

  constructor(private readonly productEvents: ProductEventsService) {
    this.removeLegacyUnscopedEntry();
  }

  /**
   * Load the remembered wallet for `userId`, or clear in-memory state when
   * logged out / switching accounts.
   */
  hydrateLastConnectedForUser(userId: string | null | undefined): void {
    this.removeLegacyUnscopedEntry();
    if (!userId) {
      this.lastConnected.next(undefined);
      return;
    }

    try {
      this.lastConnected.next(
        parseLastConnected(
          window.sessionStorage.getItem(storageKeyForUser(userId)),
          userId
        )
      );
    } catch (error) {
      this.lastConnected.next(undefined);
      this.productEvents.recordFailure('wallet.last_connected.persist', error, {
        metadata: {
          action: 'hydrate',
          storage: 'sessionStorage',
        },
      });
    }
  }

  setAccount(account: WalletAccount | undefined): void {
    this.account.next(account);
  }

  rememberConnectedWallet(wallet: LastConnectedWallet, userId: string): void {
    const scoped: LastConnectedWallet = { ...wallet, userId };
    this.lastConnected.next(scoped);
    try {
      this.removeLegacyUnscopedEntry();
      window.sessionStorage.setItem(
        storageKeyForUser(userId),
        JSON.stringify(scoped)
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

  clearLastConnectedWallet(userId?: string | null): void {
    this.lastConnected.next(undefined);
    try {
      this.removeLegacyUnscopedEntry();
      if (userId) {
        window.sessionStorage.removeItem(storageKeyForUser(userId));
      }
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

  requestOpen(mode: WalletDrawerMode = 'wallet'): void {
    this.drawerMode.next(mode);
    this.openRequested.next(true);
  }

  clearOpenRequest(): void {
    this.openRequested.next(false);
  }

  publishSwapSettled(result: SwapSettlementResult): void {
    this.swapSettled.next(result);
  }

  publishSwapSubmitted(result: { traceId: string; intentHash: string }): void {
    this.swapSubmitted.next(result);
  }

  requestSwapPreviewRefresh(traceId: string): void {
    this.swapPreviewRefreshRequested.next(traceId);
  }

  private removeLegacyUnscopedEntry(): void {
    try {
      window.sessionStorage.removeItem(LAST_CONNECTED_STORAGE_KEY_V1);
    } catch {
      // Best-effort cleanup of the pre-v2 shared key.
    }
  }
}
