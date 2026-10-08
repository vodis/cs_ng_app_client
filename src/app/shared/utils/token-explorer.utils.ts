import { ExchangeToken } from '@shared/models/exchange-token.model';

const TOKEN_EXPLORERS: Record<
  string,
  { host: string; tokenPath: (address: string) => string }
> = {
  eth: {
    host: 'https://etherscan.io',
    tokenPath: address => `https://etherscan.io/token/${address}`,
  },
  base: {
    host: 'https://basescan.org',
    tokenPath: address => `https://basescan.org/token/${address}`,
  },
  arb: {
    host: 'https://arbiscan.io',
    tokenPath: address => `https://arbiscan.io/token/${address}`,
  },
  op: {
    host: 'https://optimistic.etherscan.io',
    tokenPath: address => `https://optimistic.etherscan.io/token/${address}`,
  },
  bsc: {
    host: 'https://bscscan.com',
    tokenPath: address => `https://bscscan.com/token/${address}`,
  },
  pol: {
    host: 'https://polygonscan.com',
    tokenPath: address => `https://polygonscan.com/token/${address}`,
  },
  avax: {
    host: 'https://snowtrace.io',
    tokenPath: address => `https://snowtrace.io/token/${address}`,
  },
  gnosis: {
    host: 'https://gnosisscan.io',
    tokenPath: address => `https://gnosisscan.io/token/${address}`,
  },
  scroll: {
    host: 'https://scrollscan.com',
    tokenPath: address => `https://scrollscan.com/token/${address}`,
  },
  near: {
    host: 'https://nearblocks.io',
    tokenPath: address => `https://nearblocks.io/token/${address}`,
  },
  sol: {
    host: 'https://solscan.io',
    tokenPath: address => `https://solscan.io/token/${address}`,
  },
  ton: {
    host: 'https://tonviewer.com',
    tokenPath: address => `https://tonviewer.com/${address}`,
  },
  btc: {
    host: 'https://mempool.space',
    tokenPath: () => 'https://mempool.space',
  },
};

const EVM_ADDRESS = /0x[a-fA-F0-9]{40}/;

export function explorerUrlForToken(token: ExchangeToken): string | null {
  const explorer = TOKEN_EXPLORERS[token.blockchain];
  if (!explorer) {
    return null;
  }

  const address = tokenContractHint(token);
  if (address) {
    return explorer.tokenPath(address);
  }

  return explorer.host;
}

function tokenContractHint(token: ExchangeToken): string | undefined {
  const direct = token.contractAddress?.trim();
  if (direct) {
    return direct;
  }

  const fromAsset = EVM_ADDRESS.exec(
    `${token.assetId} ${token.executionAssetId ?? ''}`
  );
  if (fromAsset) {
    return fromAsset[0];
  }

  if (
    token.executionAssetId === 'nep141:wrap.near' ||
    token.assetId === 'nep141:wrap.near'
  ) {
    return 'wrap.near';
  }

  return undefined;
}
