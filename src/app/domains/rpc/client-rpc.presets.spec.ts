import { resolveRpcNetworkId } from './client-rpc.presets';

describe('resolveRpcNetworkId', () => {
  it('defaults missing network to ethereum', () => {
    expect(resolveRpcNetworkId(undefined)).toBe('eip155:1');
  });

  it('passes through known CAIP ids', () => {
    expect(resolveRpcNetworkId('eip155:8453')).toBe('eip155:8453');
    expect(resolveRpcNetworkId('near:mainnet')).toBe('near:mainnet');
  });

  it('maps short aliases and families', () => {
    expect(resolveRpcNetworkId('base')).toBe('eip155:8453');
    expect(resolveRpcNetworkId('arbitrum')).toBe('eip155:42161');
    expect(resolveRpcNetworkId('near:testnet')).toBe('near:mainnet');
    expect(resolveRpcNetworkId('solana:devnet')).toBe('solana:mainnet');
    expect(resolveRpcNetworkId('ton:testnet')).toBe('ton:mainnet');
  });

  it('maps unknown eip155 chain ids to ethereum', () => {
    expect(resolveRpcNetworkId('eip155:999')).toBe('eip155:1');
  });
});
