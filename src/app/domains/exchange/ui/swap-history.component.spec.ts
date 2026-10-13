import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import {
  SwapHistoryFacade,
  SwapHistoryState,
} from '../application/swap-history.facade';
import { SwapHistoryComponent } from './swap-history.component';

describe('SwapHistoryComponent recovery during outages', () => {
  const loaded: SwapHistoryState = {
    items: [
      {
        preparationId: 'pending-reference',
        createdAt: '2026-10-10T00:00:00Z',
        status: 'PROCESSING',
        sourceSymbol: 'NEAR',
        destinationSymbol: 'USDC',
        sourceDecimals: 24,
        destinationDecimals: 6,
        amountIn: '1000000000000000000000000',
        amountOut: '1000000',
        network: 'near:mainnet',
        destinationNetwork: 'near',
        recipient: 'alice.near',
      },
    ],
    nextCursor: 'older-page',
    error: '',
    signedIn: true,
    loading: false,
  };

  async function setup(state: SwapHistoryState, compact = false) {
    const state$ = new BehaviorSubject(state);
    const history = {
      state$,
      retry: jasmine.createSpy('retry'),
      check: jasmine.createSpy('check'),
      page: jasmine.createSpy('page'),
    };
    await TestBed.configureTestingModule({
      imports: [SwapHistoryComponent],
      providers: [provideRouter([])],
    })
      .overrideComponent(SwapHistoryComponent, {
        set: { providers: [{ provide: SwapHistoryFacade, useValue: history }] },
      })
      .compileComponents();
    const fixture = TestBed.createComponent(SwapHistoryComponent);
    fixture.componentInstance.compact = compact;
    fixture.detectChanges();
    const element: unknown = fixture.nativeElement;
    if (!(element instanceof HTMLElement))
      throw new Error('Missing history element');
    return { fixture, element, history, state$ };
  }

  it('keeps references and status checks visible beside the stale warning', async () => {
    const { fixture, element, history, state$ } = await setup(loaded);
    state$.next({ ...loaded, error: 'Could not load swap history.' });
    fixture.detectChanges();
    expect(element.querySelector('tbody')?.textContent).toContain(
      'pending-reference'
    );
    expect(element.querySelector('tbody')?.textContent).toContain('Processing');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'out of date'
    );
    const buttons = Array.from(element.querySelectorAll('button'));
    buttons
      .find(button => button.textContent?.trim() === 'Check status')
      ?.click();
    expect(history.check).toHaveBeenCalledWith('pending-reference');
    buttons.find(button => button.textContent?.trim() === 'Retry')?.click();
    expect(history.retry).toHaveBeenCalled();
    expect(element.textContent).toContain('Older swaps');
    state$.next({ ...loaded, items: [], nextCursor: null });
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')).toBeNull();
    expect(element.textContent).not.toContain('pending-reference');
    expect(element.textContent).toContain('No swaps yet');
    expect(element.textContent).toContain(
      'Your swap history will appear here.'
    );
    expect(element.textContent).not.toContain('after you confirm');
  });

  it('does not claim an empty history when the first load fails', async () => {
    const { element } = await setup({
      ...loaded,
      items: [],
      nextCursor: null,
      error: 'Could not load swap history.',
    });
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load'
    );
    expect(element.textContent).not.toContain('No swaps yet');
    expect(element.textContent).not.toContain('previously loaded');
  });

  it('keeps rows visible and disables refresh while loading', async () => {
    const { fixture, element, history, state$ } = await setup(loaded);
    state$.next({ ...loaded, loading: true });
    fixture.detectChanges();
    expect(element.querySelector('tbody')?.textContent).toContain('NEAR');
    expect(element.querySelector('tbody')?.textContent).toContain('Processing');
    const refresh = element.querySelector(
      '.swap-history__refresh'
    ) as HTMLButtonElement | null;
    expect(refresh?.disabled).toBeTrue();
    refresh?.click();
    expect(history.retry).not.toHaveBeenCalled();
  });

  it('renders distinct status labels and settled vs quoted amounts', async () => {
    const { element } = await setup({
      ...loaded,
      items: [
        {
          ...loaded.items[0],
          preparationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          status: 'SUCCESS',
          sourceSymbol: 'WETH.e',
          destinationSymbol: 'USDC.e',
          amountIn: '1000000000000000000',
          amountOut: '2000000',
          sourceDecimals: 18,
          destinationDecimals: 6,
          receipt: {
            amountIn: '1000000000000000000',
            amountOut: '1999999',
            transactions: [
              {
                hash: '0xabc',
                explorerUrl: 'https://etherscan.io/tx/0xabc',
              },
            ],
          },
        },
        {
          ...loaded.items[0],
          preparationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          status: 'FAILED',
          amountIn: '1',
          amountOut: '1',
          sourceDecimals: 24,
          destinationDecimals: 6,
        },
        {
          ...loaded.items[0],
          preparationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          status: 'INCOMPLETE_DEPOSIT',
          amountIn: '1',
          amountOut: '1',
          sourceDecimals: 24,
          destinationDecimals: 6,
        },
      ],
    });
    expect(element.textContent).toContain('Completed');
    expect(element.textContent).toContain('Failed');
    expect(element.textContent).toContain('Incomplete deposit');
    expect(element.textContent).toContain('Settled');
    expect(element.textContent).toContain('Quoted');
    expect(element.textContent).toContain('WETH.e');
    expect(element.textContent).toContain('1,999999');
    expect(element.textContent).toContain('0,000000000000000000000001');
    expect(element.querySelector('.swap-history__view-all')).toBeNull();
  });

  it('shows the compact view-all link on the home panel', async () => {
    const { element } = await setup(loaded, true);
    expect(
      element.querySelector('.swap-history__title')?.textContent
    ).toContain('Recent activity');
    expect(
      element.querySelector('.swap-history__view-all')?.getAttribute('href')
    ).toBe('/history');
  });
});
