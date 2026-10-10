import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type { SwapQuotePreview } from '@domains/exchange/models/swap.models';
import { SwapQuoteGateway } from './swap-quote.gateway';
import { SwapFlowFacade, SwapFormInput } from './swap-flow.facade';

class SwapQuoteGatewayStub implements Pick<
  SwapQuoteGateway,
  'requestQuotePreview' | 'requestQuotePreviewStream'
> {
  public readonly quoteCalls: Array<{
    input: SwapFormInput;
    traceId: string;
    response: Subject<{ traceId: string; preview: SwapQuotePreview }>;
  }> = [];

  public requestQuotePreviewStream(input: SwapFormInput, traceId: string) {
    const response = new Subject<{
      traceId: string;
      preview: SwapQuotePreview;
    }>();
    this.quoteCalls.push({ input, traceId, response });
    return response.asObservable();
  }

  public async requestQuotePreview(
    input: SwapFormInput,
    traceId: string
  ): Promise<{ traceId: string; preview: SwapQuotePreview }> {
    return {
      traceId,
      preview: preview(input.amount),
    };
  }
}

function preview(amountOut: string): SwapQuotePreview {
  return {
    amountOut,
    amountOutAtomic: amountOut,
    expiresAt: '2099-01-01T00:00:00.000Z',
    raw: { amountOut },
  };
}

describe('SwapFlowFacade quote preview refresh', () => {
  let workflow: SwapQuoteGatewayStub;
  let facade: SwapFlowFacade;

  beforeEach(() => {
    workflow = new SwapQuoteGatewayStub();
    facade = new SwapFlowFacade(workflow);
  });

  afterEach(fakeAsync(() => {
    facade.reset();
    discardPeriodicTasks();
  }));

  it('ignores a late quote response after the input changes', fakeAsync(() => {
    facade.watchQuotePreview(input({ amount: '1000000' }));
    tick(350);

    expect(workflow.quoteCalls.length).toBe(1);
    const firstQuote = workflow.quoteCalls[0];

    facade.watchQuotePreview(input({ amount: '2000000' }));
    expect(facade.quotePreview).toBeUndefined();
    tick(350);

    expect(workflow.quoteCalls.length).toBe(2);
    firstQuote.response.next({
      traceId: firstQuote.traceId,
      preview: preview('111'),
    });
    expect(facade.quotePreview).toBeUndefined();

    const secondQuote = workflow.quoteCalls[1];
    secondQuote.response.next({
      traceId: secondQuote.traceId,
      preview: preview('222'),
    });

    expect(facade.quotePreview?.amountOut).toBe('222');
  }));

  it('refreshes an unchanged quote input every 60 seconds', fakeAsync(() => {
    facade.watchQuotePreview(input({ amount: '1000000' }));
    tick(350);

    expect(workflow.quoteCalls.length).toBe(1);
    workflow.quoteCalls[0].response.next({
      traceId: workflow.quoteCalls[0].traceId,
      preview: preview('111'),
    });

    tick(59_999);
    expect(workflow.quoteCalls.length).toBe(1);

    tick(1);
    expect(workflow.quoteCalls.length).toBe(2);
    expect(workflow.quoteCalls[1].input.amount).toBe('1000000');
  }));

  it('clears quote state and stops refreshes when input becomes invalid', fakeAsync(() => {
    facade.watchQuotePreview(input({ amount: '1000000' }));
    tick(350);

    workflow.quoteCalls[0].response.next({
      traceId: workflow.quoteCalls[0].traceId,
      preview: preview('111'),
    });
    expect(facade.quotePreview?.amountOut).toBe('111');

    facade.watchQuotePreview(undefined);
    expect(facade.quotePreview).toBeUndefined();

    tick(60_000);
    expect(workflow.quoteCalls.length).toBe(1);
  }));

  it('refreshes case-sensitive recipient addresses that differ only by case', fakeAsync(() => {
    facade.watchQuotePreview(
      input({ recipient: 'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z' })
    );
    tick(350);

    facade.watchQuotePreview(
      input({ recipient: 'bYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z' })
    );
    tick(350);

    expect(workflow.quoteCalls.length).toBe(2);
    expect(workflow.quoteCalls[1].input.recipient).toBe(
      'bYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z'
    );
  }));

  it('keeps the in-flight quote for unchanged user choices', fakeAsync(() => {
    facade.watchQuotePreview(input());
    tick(350);

    facade.watchQuotePreview(input());
    tick(350);

    expect(workflow.quoteCalls.length).toBe(1);
  }));

  it('refreshes when privacy preference or wallet account changes', fakeAsync(() => {
    facade.watchQuotePreview(input());
    tick(350);

    facade.watchQuotePreview(input({ confidential: true }));
    tick(350);

    facade.watchQuotePreview(
      input({ confidential: true, account: 'other.near' })
    );
    tick(350);

    expect(workflow.quoteCalls.length).toBe(3);
  }));

  it('requests a new quote when either asset or network context changes', fakeAsync(() => {
    facade.watchQuotePreview(input());
    tick(350);
    facade.watchQuotePreview(
      input({ source: { ...input().source, executionAssetId: 'nep141:usdt' } })
    );
    tick(350);
    facade.watchQuotePreview(
      input({
        source: { ...input().source, executionAssetId: 'nep141:usdt' },
        destination: { ...input().destination, executionAssetId: 'nep141:btc' },
      })
    );
    tick(350);
    facade.watchQuotePreview(
      input({
        source: { ...input().source, executionAssetId: 'nep141:usdt' },
        destination: { ...input().destination, executionAssetId: 'nep141:btc' },
        network: { id: 'eip155:8453', label: 'Base' },
      })
    );
    tick(350);

    expect(workflow.quoteCalls.length).toBe(4);
  }));

  it('clears the failure after automatic recovery and refreshes before expiry', fakeAsync(() => {
    facade.watchQuotePreview(input());
    tick(350);
    workflow.quoteCalls[0].response.error(new Error('Offline'));
    expect(facade.error?.message).toBe('Offline');
    tick(60_000);
    workflow.quoteCalls[1].response.next({
      traceId: 'recovered',
      preview: {
        ...preview('100'),
        expiresAt: new Date(Date.now() + 20_000).toISOString(),
      },
    });
    expect(facade.error).toBeUndefined();
    tick(15_000);
    expect(workflow.quoteCalls.length).toBe(3);
  }));

  it('invalidates the quote when the amount mode changes', fakeAsync(() => {
    facade.watchQuotePreview(input());
    tick(350);
    facade.watchQuotePreview(input({ swapType: 'EXACT_OUTPUT' }));
    tick(350);
    expect(workflow.quoteCalls.length).toBe(2);
    expect(workflow.quoteCalls[1].input.swapType).toBe('EXACT_OUTPUT');
  }));

  function input(overrides: Partial<SwapFormInput> = {}): SwapFormInput {
    return {
      source: {
        assetId: 'nep141:usdc',
        executionAssetId: 'nep141:usdc',
        symbol: 'USDC',
        name: 'USDC',
        decimals: 6,
      },
      destination: {
        assetId: 'nep141:near',
        executionAssetId: 'nep141:near',
        symbol: 'NEAR',
        name: 'NEAR',
        decimals: 24,
      },
      amount: '1000000',
      account: '0x0000000000000000000000000000000000000001',
      recipient: '0x0000000000000000000000000000000000000001',
      slippageToleranceBps: 50,
      confidential: false,
      network: { id: 'eip155:1', label: 'Ethereum' },
      ...overrides,
    };
  }
});
