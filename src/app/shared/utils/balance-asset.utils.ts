import type { ExchangeToken } from '@shared/models/exchange-token.model';
import type { WalletBalance } from '@shared/services/wallet-balances.service';
import { walletBlockchain } from './network.utils';

/** Normalize only equivalent backend balance identifiers, never execution/funding aliases. */
export function canonicalBalanceAssetId(
  assetId: string,
  network: string
): string {
  if (network.startsWith('near:'))
    return assetId.replace(/^1cs_v1:near:nep141:/, 'nep141:');
  return assetId;
}

export function isNativeEvmToken(token: ExchangeToken): boolean {
  return (
    (token.balanceAssetId?.startsWith('eip155:') === true &&
      token.balanceAssetId.endsWith('/native')) ||
    /^(?:0x0{40}|0xe{40})$/i.test(token.contractAddress ?? '')
  );
}

export function tokenBalance(
  rows: WalletBalance[],
  token: ExchangeToken,
  network?: string
): WalletBalance | undefined {
  if (!network) return undefined;
  const blockchain = network.startsWith('near:')
    ? 'near'
    : network.startsWith('ton:')
      ? 'ton'
      : walletBlockchain('', Number(network.split(':')[1]));
  if (token.blockchain !== blockchain) return undefined;
  const assetId =
    token.balanceAssetId ??
    (network.startsWith('eip155:') && isNativeEvmToken(token)
      ? `${network}/native`
      : canonicalBalanceAssetId(token.assetId, network));
  return rows.find(
    row =>
      row.network === network &&
      canonicalBalanceAssetId(row.assetId, network) === assetId
  );
}

export function hasPositiveBalance(row: WalletBalance): boolean {
  return /^\d+$/.test(row.balanceRaw) && BigInt(row.balanceRaw) > 0n;
}
