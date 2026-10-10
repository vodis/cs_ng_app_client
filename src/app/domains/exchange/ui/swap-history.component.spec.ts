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

  async function setup(state: SwapHistoryState) {
    const state$ = new BehaviorSubject(state);
    const history = {
      state$,
      retry: jasmine.createSpy('retry'),
      check: jasmine.createSpy('check'),
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
});
