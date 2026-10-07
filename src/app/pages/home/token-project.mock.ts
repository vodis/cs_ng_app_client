import type { WalletMarketSocialLink } from '@shared/utils/market-display.util';

export type TokenProjectMock = {
  marketCapUsd?: number;
  volume24hUsd?: number;
  websiteUrl?: string;
  whitepaperUrl?: string;
  explorerUrl?: string;
  socialLinks?: WalletMarketSocialLink[];
};

/** Temporary CMC-style project facts until the BFF snapshots include them. */
export const TOKEN_PROJECT_MOCKS: Record<string, TokenProjectMock> = {
  USDC: {
    marketCapUsd: 32_000_000_000,
    volume24hUsd: 4_500_000_000,
    websiteUrl: 'https://www.circle.com/usdc',
    whitepaperUrl: 'https://www.circle.com/en/docs',
    explorerUrl:
      'https://etherscan.io/token/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    socialLinks: [
      { kind: 'x', url: 'https://x.com/circle', label: 'X' },
      { kind: 'github', url: 'https://github.com/circlefin', label: 'GitHub' },
    ],
  },
  NEAR: {
    marketCapUsd: 6_100_000_000,
    volume24hUsd: 312_000_000,
    websiteUrl: 'https://near.org',
    whitepaperUrl: 'https://docs.near.org',
    explorerUrl: 'https://nearblocks.io',
    socialLinks: [
      { kind: 'x', url: 'https://x.com/NEARProtocol', label: 'X' },
      { kind: 'github', url: 'https://github.com/near', label: 'GitHub' },
      { kind: 'discord', url: 'https://discord.gg/nearprotocol', label: 'Discord' },
    ],
  },
  WNEAR: {
    marketCapUsd: 6_100_000_000,
    volume24hUsd: 312_000_000,
    websiteUrl: 'https://near.org',
    whitepaperUrl: 'https://docs.near.org',
    explorerUrl: 'https://nearblocks.io/token/wrap.near',
    socialLinks: [
      { kind: 'x', url: 'https://x.com/NEARProtocol', label: 'X' },
      { kind: 'github', url: 'https://github.com/near', label: 'GitHub' },
    ],
  },
  AAVE: {
    marketCapUsd: 2_800_000_000,
    volume24hUsd: 180_000_000,
    websiteUrl: 'https://aave.com',
    whitepaperUrl: 'https://docs.aave.com',
    explorerUrl:
      'https://etherscan.io/token/0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
    socialLinks: [
      { kind: 'x', url: 'https://x.com/aave', label: 'X' },
      { kind: 'github', url: 'https://github.com/aave', label: 'GitHub' },
      { kind: 'discord', url: 'https://discord.com/invite/aave', label: 'Discord' },
    ],
  },
  ETH: {
    marketCapUsd: 395_000_000_000,
    volume24hUsd: 18_400_000_000,
    websiteUrl: 'https://ethereum.org',
    whitepaperUrl: 'https://ethereum.org/en/whitepaper/',
    explorerUrl: 'https://etherscan.io',
    socialLinks: [
      { kind: 'x', url: 'https://x.com/ethereum', label: 'X' },
      { kind: 'github', url: 'https://github.com/ethereum', label: 'GitHub' },
    ],
  },
  BTC: {
    marketCapUsd: 1_200_000_000_000,
    volume24hUsd: 28_000_000_000,
    websiteUrl: 'https://bitcoin.org',
    whitepaperUrl: 'https://bitcoin.org/bitcoin.pdf',
    explorerUrl: 'https://mempool.space',
    socialLinks: [
      { kind: 'github', url: 'https://github.com/bitcoin/bitcoin', label: 'GitHub' },
      { kind: 'reddit', url: 'https://www.reddit.com/r/Bitcoin/', label: 'Reddit' },
    ],
  },
  USDT: {
    marketCapUsd: 120_000_000_000,
    volume24hUsd: 48_000_000_000,
    websiteUrl: 'https://tether.to',
    whitepaperUrl: 'https://tether.to/en/transparency/',
    explorerUrl:
      'https://etherscan.io/token/0xdac17f958d2ee523a2206206994597c13d831ec7',
    socialLinks: [{ kind: 'x', url: 'https://x.com/Tether_to', label: 'X' }],
  },
};
