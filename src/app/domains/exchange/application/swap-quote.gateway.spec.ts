import { SwapQuoteGateway } from './swap-quote.gateway';
import { WalletGatewayBridgeService } from '@shared/mfe/wallets/wallet-gateway.bridge.service';
import type { WalletSwapInput } from '@mfe-contracts/swap-review.types';

describe('SwapQuoteGateway', () => {
  it('cancels the remote request when a preview subscription is replaced', () => {
    const bridge = jasmine.createSpyObj<WalletGatewayBridgeService>('bridge', [
      'requestSwapQuote',
    ]);
    bridge.requestSwapQuote.and.returnValue(new Promise(() => {}));
    const gateway = new SwapQuoteGateway(bridge);
    const input: WalletSwapInput = {
      source: {
        assetId: 'near:native',
        executionAssetId: 'nep141:wrap.near',
        name: 'NEAR',
        symbol: 'NEAR',
        decimals: 24,
      },
      destination: {
        assetId: 'usdc',
        executionAssetId: 'usdc',
        name: 'USDC',
        symbol: 'USDC',
        decimals: 6,
      },
      amount: '1',
      account: 'alice.near',
      recipient: 'alice.near',
      network: { id: 'near:mainnet', label: 'NEAR' },
      slippageToleranceBps: 50,
      confidential: false,
    };
    const subscription = gateway
      .requestQuotePreviewStream(input, 'trace')
      .subscribe();
    const [sent, options] = bridge.requestSwapQuote.calls.mostRecent().args;
    expect(sent).toBe(input);
    expect(options.traceId).toBe('trace');
    expect(options.signal.aborted).toBeFalse();
    subscription.unsubscribe();
    expect(options.signal.aborted).toBeTrue();
  });
});
