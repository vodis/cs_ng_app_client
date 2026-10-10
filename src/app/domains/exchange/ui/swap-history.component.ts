import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  SwapHistoryFacade,
  type SwapHistoryItem,
} from '../application/swap-history.facade';
import { atomicToDecimal } from '@shared/utils/amount-format.utils';

@Component({
  selector: 'app-swap-history',
  standalone: true,
  imports: [CommonModule, RouterLink],
  providers: [SwapHistoryFacade],
  template: `
    <section aria-label="Swap history" class="swap-history">
      <header>
        <h2>{{ compact ? 'Recent activity' : 'Swap history' }}</h2>
        <button type="button" (click)="history.retry()">Refresh</button>
      </header>
      @if (history.state$ | async; as state) {
        @if (!state.signedIn) {
          <p>Sign in to see your swaps.</p>
        } @else if (state.loading) {
          <p role="status">Loading swap history…</p>
        } @else if (state.error) {
          <p role="alert">{{ state.error }}</p>
          <button type="button" (click)="history.retry()">Retry</button>
        } @else if (!state.items.length) {
          <p>
            No swaps yet. Your exchanges will appear here after you confirm.
          </p>
        } @else {
          <div class="history-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>You pay</th>
                  <th>Receive</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                @for (
                  item of compact ? state.items.slice(0, 5) : state.items;
                  track item.preparationId
                ) {
                  <tr>
                    <td>{{ item.createdAt | date: 'short' }}</td>
                    <td>
                      {{
                        amount(
                          item.receipt?.amountIn ?? item.amountIn,
                          item.sourceDecimals
                        )
                      }}
                      {{ item.sourceSymbol }}
                      <small>{{
                        item.receipt?.amountIn ? 'Settled' : 'Quoted'
                      }}</small>
                      @if (item.receipt?.refundedAmount; as refunded) {
                        <small
                          >Refunded: {{ amount(refunded, item.sourceDecimals) }}
                          {{ item.sourceSymbol }}</small
                        >
                      }
                    </td>
                    <td>
                      {{
                        amount(
                          item.status === 'SUCCESS' && item.receipt?.amountOut
                            ? item.receipt!.amountOut!
                            : item.amountOut,
                          item.destinationDecimals
                        )
                      }}
                      {{ item.destinationSymbol
                      }}<small>{{
                        item.status === 'SUCCESS' && item.receipt?.amountOut
                          ? 'Settled'
                          : 'Quoted'
                      }}</small>
                    </td>
                    <td>{{ status(item) }}</td>
                    <td>
                      <details>
                        <summary>Exchange details</summary>
                        <p>
                          {{ item.network }} → {{ item.destinationNetwork }}
                        </p>
                        <p>Recipient: {{ item.recipient }}</p>
                        <p>Reference: {{ item.preparationId }}</p>
                        <button
                          type="button"
                          (click)="history.check(item.preparationId)">
                          Check status
                        </button>
                        @for (
                          tx of item.receipt?.transactions ?? [];
                          track tx.hash
                        ) {
                          <p>
                            <a
                              [href]="tx.explorerUrl"
                              target="_blank"
                              rel="noopener noreferrer"
                              >View transaction {{ tx.hash }}</a
                            >
                          </p>
                        }
                        @if (
                          item.status === 'UNKNOWN' ||
                          item.status === 'INCOMPLETE_DEPOSIT' ||
                          item.status === 'FAILED'
                        ) {
                          <p>
                            Check your wallet before starting another exchange.
                            Refresh only checks status; it never sends funds.
                          </p>
                        }
                      </details>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (compact) {
            <a routerLink="/history">View all swaps →</a>
          } @else {
            <button type="button" (click)="history.page('')">Latest</button>
            @if (state.nextCursor) {
              <button type="button" (click)="history.page(state.nextCursor)">
                Older swaps
              </button>
            }
          }
        }
      } @else {
        <p role="status">Loading swap history…</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .swap-history {
        padding: 24px;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      h2 {
        font-size: 1.5rem;
      }
      .history-scroll {
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid var(--main-border-color);
        vertical-align: top;
      }
      button,
      a,
      summary {
        cursor: pointer;
      }
      details p {
        overflow-wrap: anywhere;
        max-width: 30rem;
      }
      button {
        padding: 8px 16px;
      }
    `,
  ],
})
export class SwapHistoryComponent {
  @Input() compact = false;
  readonly history = inject(SwapHistoryFacade);
  amount(value: string, decimals: number): string {
    return atomicToDecimal(value, decimals);
  }
  status(item: SwapHistoryItem): string {
    switch (item.status) {
      case 'AWAITING_APPROVAL':
        return 'Awaiting approval';
      case 'SUBMITTED':
        return 'Submitted';
      case 'CANCELLED':
        return 'Approval cancelled';
      case 'SUCCESS':
        return 'Completed';
      case 'REFUNDED':
        return 'Refunded';
      case 'FAILED':
      case 'INCOMPLETE_DEPOSIT':
        return 'Needs attention';
      case 'KNOWN_DEPOSIT_TX':
        return 'Submitted';
      case 'PENDING_DEPOSIT':
        return 'Awaiting deposit confirmation';
      case 'PROCESSING':
        return 'Processing';
      default:
        return 'Status unknown';
    }
  }
}
