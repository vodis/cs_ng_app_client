import { discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { Subject } from 'rxjs';
import type {
  ApprovedSwapPreparePackage,
  SwapQuotePreview,
} from '@domains/exchange/models/swap.models';
import { SwapExecutionWorkflow } from './swap-execution.workflow';
import { SwapFlowFacade, SwapFormInput } from './swap-flow.facade';

class SwapExecutionWorkflowStub implements Pick<
  SwapExecutionWorkflow,
  'requestQuotePreview' | 'requestQuotePreviewStream' | 'executeSwap'
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

  public async executeSwap(
    _input: SwapFormInput,
    traceId: string
  ): Promise<{
    traceId: string;
    preparePackage: ApprovedSwapPreparePackage;
    intentHash: string;
  }> {
    return {
      traceId,
      preparePackage: approvedPreparePackage(),
      intentHash: 'hash',
    };
  }
}

function preview(amountOut: string): SwapQuotePreview {
  return {
    amountOut,
    raw: { amountOut },
  };
}

function approvedPreparePackage(): ApprovedSwapPreparePackage {
  return {
    protocol: 'near-intents',
    providerId: 'solver-relay',
    kind: 'swap',
    quoteHashes: ['quote-hash'],
    signerId: '0x0000000000000000000000000000000000000001',
    authMethod: 'evm',
    deadlineTimestamp: 1_765_497_600,
    tokenDeltas: [
      {
        assetId: 'nep141:usdc',
        amount: '-1000000',
      },
      {
        assetId: 'nep141:near',
        amount: '1000000',
      },
    ],
  };
}

describe('SwapFlowFacade quote preview refresh', () => {
  let workflow: SwapExecutionWorkflowStub;
  let facade: SwapFlowFacade;

  beforeEach(() => {
    workflow = new SwapExecutionWorkflowStub();
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

  function input(overrides: Partial<SwapFormInput> = {}): SwapFormInput {
    return {
      originAsset: 'nep141:usdc',
      destinationAsset: 'nep141:near',
      amount: '1000000',
      userAddress: '0x0000000000000000000000000000000000000001',
      slippageTolerance: 50,
      deadline: '2026-06-17T00:15:00.000Z',
      authMethod: 'evm',
      ...overrides,
    };
  }
});
