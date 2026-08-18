const EVM_BLOCKCHAINS = new Set([
  'eth',
  'base',
  'arb',
  'gnosis',
  'bera',
  'bsc',
  'pol',
  'op',
  'avax',
  'xlayer',
  'monad',
  'plasma',
  'scroll',
]);

const CHAIN_ID_TO_BLOCKCHAIN: Record<number, string> = {
  1: 'eth',
  10: 'op',
  56: 'bsc',
  100: 'gnosis',
  137: 'pol',
  8453: 'base',
  42161: 'arb',
  43114: 'avax',
  534352: 'scroll',
};

const NETWORK_LABELS: Record<string, string> = {
  eth: 'Ethereum',
  base: 'Base',
  arb: 'Arbitrum',
  near: 'NEAR',
  btc: 'Bitcoin',
  sol: 'Solana',
  ton: 'TON',
  dash: 'Dash',
  doge: 'Dogecoin',
  xrp: 'XRP',
  zec: 'Zcash',
  gnosis: 'Gnosis',
  bera: 'Berachain',
  bsc: 'BNB Chain',
  pol: 'Polygon',
  tron: 'Tron',
  sui: 'Sui',
  op: 'Optimism',
  avax: 'Avalanche',
  cardano: 'Cardano',
  ltc: 'Litecoin',
  xlayer: 'XLayer',
  monad: 'Monad',
  bch: 'Bitcoin Cash',
  adi: 'ADI',
  plasma: 'Plasma',
  scroll: 'Scroll',
  starknet: 'Starknet',
  aleo: 'Aleo',
  stellar: 'Stellar',
  aptos: 'Aptos',
};

export function networkLabel(blockchain: string | undefined): string {
  if (!blockchain) return 'Connect wallet';
  return (
    NETWORK_LABELS[blockchain] ??
    blockchain.charAt(0).toUpperCase() + blockchain.slice(1)
  );
}

export function walletBlockchain(
  account: string,
  chainId: number | null
): string | undefined {
  if (/^[a-z0-9._-]+\.(?:near|testnet|tg)$/i.test(account)) return 'near';
  return chainId == null ? undefined : CHAIN_ID_TO_BLOCKCHAIN[chainId];
}

export function recipientAddressError(
  blockchain: string,
  rawAddress: string
): string {
  const address = rawAddress.trim();
  if (!address) return 'Enter a recipient address.';
  if (/\s/.test(address)) return 'Wallet addresses cannot contain spaces.';

  let valid = true;
  if (EVM_BLOCKCHAINS.has(blockchain))
    valid = /^0x[a-fA-F0-9]{40}$/.test(address);
  else if (blockchain === 'near')
    valid = /^(?:[a-z0-9._-]+\.(?:near|testnet|tg)|[a-f0-9]{64})$/i.test(
      address
    );
  else if (blockchain === 'sol')
    valid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  else if (blockchain === 'btc')
    valid =
      /^(?:[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[ac-hj-np-z02-9]{11,87})$/i.test(
        address
      );
  else if (blockchain === 'doge')
    valid = /^[DA9][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
  else if (blockchain === 'zec')
    valid = /^t[13][1-9A-HJ-NP-Za-km-z]{20,}$/.test(address);
  else if (blockchain === 'bch')
    valid =
      /^(?:[13][1-9A-HJ-NP-Za-km-z]{25,34}|(?:bitcoincash:)?[qp][a-z0-9]{41,})$/i.test(
        address
      );
  else if (blockchain === 'ltc')
    valid =
      /^(?:[LM3][1-9A-HJ-NP-Za-km-z]{25,34}|ltc1[ac-hj-np-z02-9]{11,87})$/i.test(
        address
      );
  else if (blockchain === 'dash')
    valid = /^X[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(address);
  else if (blockchain === 'xrp')
    valid =
      /^(?:r[1-9A-HJ-NP-Za-km-z]{24,34}|X[1-9A-HJ-NP-Za-km-z]{40,})$/.test(
        address
      );
  else if (blockchain === 'tron')
    valid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  else if (blockchain === 'ton')
    valid = /^(?:EQ|UQ)[A-Za-z0-9_-]{46}$/.test(address);
  else if (blockchain === 'stellar') valid = /^G[A-Z2-7]{55}$/.test(address);
  else if (blockchain === 'cardano')
    valid = /^addr1[0-9a-z]{20,}$/.test(address);
  else if (blockchain === 'aleo') valid = /^aleo1[0-9a-z]{58}$/.test(address);
  else if (blockchain === 'aptos' || blockchain === 'sui')
    valid = /^0x[a-fA-F0-9]{64}$/.test(address);
  else if (blockchain === 'starknet')
    valid = /^0x[a-fA-F0-9]{1,64}$/.test(address);
  else valid = address.length >= 8 && address.length <= 128;

  return valid ? '' : `Enter a valid ${networkLabel(blockchain)} address.`;
}
