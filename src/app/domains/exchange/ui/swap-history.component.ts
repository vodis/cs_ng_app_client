import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import {
  SwapHistoryFacade,
  type SwapHistoryItem,
} from '../application/swap-history.facade';
import {
  atomicToDecimal,
  formatSwapAmountDisplay,
} from '@shared/utils/amount-format.utils';

@Component({
  selector: 'app-swap-history',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  providers: [SwapHistoryFacade],
  template: `
    <section
      aria-label="Swap history"
      class="swap-history"
      [class.swap-history--compact]="compact">
      @if (history.state$ | async; as state) {
        <header class="swap-history__head">
          <h2 class="swap-history__title">
            {{ compact ? 'Recent activity' : 'Swap history' }}
          </h2>
          <button
            type="button"
            class="swap-history__refresh"
            [disabled]="state.loading"
            [attr.aria-busy]="state.loading ? 'true' : null"
            [attr.aria-label]="
              state.loading ? 'Refreshing swap history' : 'Refresh swap history'
            "
            (click)="onRefresh($event)">
            <mat-icon
              aria-hidden="true"
              [class.swap-history__refresh-icon--spin]="state.loading"
              >refresh</mat-icon
            >
          </button>
        </header>

        @if (state.error) {
          <div class="swap-history__banner" role="alert">
            <p class="swap-history__banner-text">
              {{ state.error }}
              @if (state.items.length) {
                Showing previously loaded exchanges; their status may be out of
                date.
              }
            </p>
            <button
              type="button"
              class="swap-history__retry"
              [disabled]="state.loading"
              (click)="history.retry()">
              Retry
            </button>
          </div>
        }

        @if (!state.signedIn) {
          <p class="swap-history__empty-title">Sign in to see your swaps.</p>
        } @else if (state.loading && !state.items.length) {
          <p class="swap-history__status" role="status">
            Loading swap history…
          </p>
        } @else if (!state.items.length) {
          @if (!state.error) {
            <div class="swap-history__empty">
              <p class="swap-history__empty-title">No swaps yet</p>
              <p class="swap-history__empty-hint">
                Your swap history will appear here.
              </p>
            </div>
          }
        } @else {
          @let visible = compact ? state.items.slice(0, 5) : state.items;

          <div class="swap-history__body">
            <div class="swap-history__table-wrap">
              <table class="swap-history__table">
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Pair</th>
                    <th scope="col">Paid</th>
                    <th scope="col">Received</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span class="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of visible; track item.preparationId) {
                    <tr>
                      <td class="swap-history__time">
                        {{ item.createdAt | date: 'short' }}
                      </td>
                      <td class="swap-history__pair">
                        <span class="swap-history__pair-text"
                          >{{ item.sourceSymbol }}
                          <span
                            class="swap-history__pair-arrow"
                            aria-hidden="true"
                            >→</span
                          >
                          {{ item.destinationSymbol }}</span
                        >
                      </td>
                      <td class="swap-history__amount">
                        <span class="swap-history__amount-value">
                          {{ paidAmount(item) }}
                          {{ item.sourceSymbol }}
                        </span>
                        <span class="swap-history__amount-meta">{{
                          paidLabel(item)
                        }}</span>
                        @if (item.receipt?.refundedAmount; as refunded) {
                          <span class="swap-history__amount-meta">
                            Refunded:
                            {{ formatAmount(refunded, item.sourceDecimals) }}
                            {{ item.sourceSymbol }}
                          </span>
                        }
                      </td>
                      <td class="swap-history__amount">
                        <span class="swap-history__amount-value">
                          {{ receivedAmount(item) }}
                          {{ item.destinationSymbol }}
                        </span>
                        <span class="swap-history__amount-meta">{{
                          receivedLabel(item)
                        }}</span>
                      </td>
                      <td>
                        <span
                          class="swap-history__status-pill"
                          [attr.data-status]="statusTone(item)"
                          >{{ status(item) }}</span
                        >
                      </td>
                      <td class="swap-history__details-cell">
                        <ng-container
                          *ngTemplateOutlet="
                            detailsTpl;
                            context: { $implicit: item }
                          " />
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <ul class="swap-history__list">
              @for (item of visible; track item.preparationId) {
                <li class="swap-history__item">
                  <div class="swap-history__item-top">
                    <span class="swap-history__pair-text"
                      >{{ item.sourceSymbol }}
                      <span class="swap-history__pair-arrow" aria-hidden="true"
                        >→</span
                      >
                      {{ item.destinationSymbol }}</span
                    >
                    <span
                      class="swap-history__status-pill"
                      [attr.data-status]="statusTone(item)"
                      >{{ status(item) }}</span
                    >
                  </div>
                  <div class="swap-history__item-amounts">
                    <div class="swap-history__amount">
                      <span class="swap-history__amount-label">Paid</span>
                      <span class="swap-history__amount-value">
                        {{ paidAmount(item) }}
                        {{ item.sourceSymbol }}
                      </span>
                      <span class="swap-history__amount-meta">{{
                        paidLabel(item)
                      }}</span>
                      @if (item.receipt?.refundedAmount; as refunded) {
                        <span class="swap-history__amount-meta">
                          Refunded:
                          {{ formatAmount(refunded, item.sourceDecimals) }}
                          {{ item.sourceSymbol }}
                        </span>
                      }
                    </div>
                    <div class="swap-history__amount">
                      <span class="swap-history__amount-label">Received</span>
                      <span class="swap-history__amount-value">
                        {{ receivedAmount(item) }}
                        {{ item.destinationSymbol }}
                      </span>
                      <span class="swap-history__amount-meta">{{
                        receivedLabel(item)
                      }}</span>
                    </div>
                  </div>
                  <div class="swap-history__item-foot">
                    <time
                      class="swap-history__time"
                      [attr.datetime]="item.createdAt"
                      >{{ item.createdAt | date: 'short' }}</time
                    >
                    <ng-container
                      *ngTemplateOutlet="
                        detailsTpl;
                        context: { $implicit: item }
                      " />
                  </div>
                </li>
              }
            </ul>
          </div>

          <footer class="swap-history__footer">
            @if (compact) {
              <a class="swap-history__view-all" routerLink="/history"
                >View all swaps →</a
              >
            } @else {
              <div class="swap-history__paging">
                <button
                  type="button"
                  class="swap-history__page-btn"
                  [disabled]="state.loading"
                  (click)="history.page('')">
                  Latest
                </button>
                @if (state.nextCursor) {
                  <button
                    type="button"
                    class="swap-history__page-btn"
                    [disabled]="state.loading"
                    (click)="history.page(state.nextCursor)">
                    Older swaps
                  </button>
                }
              </div>
            }
          </footer>
        }
      } @else {
        <header class="swap-history__head">
          <h2 class="swap-history__title">
            {{ compact ? 'Recent activity' : 'Swap history' }}
          </h2>
        </header>
        <p class="swap-history__status" role="status">Loading swap history…</p>
      }
    </section>

    <ng-template #detailsTpl let-item>
      <details class="swap-history__details">
        <summary>Details</summary>
        <div class="swap-history__details-body">
          <p>{{ item.network }} → {{ item.destinationNetwork }}</p>
          <p>Recipient: {{ item.recipient }}</p>
          <p>Reference: {{ item.preparationId }}</p>
          <button
            type="button"
            class="swap-history__page-btn"
            (click)="history.check(item.preparationId)">
            Check status
          </button>
          @for (tx of item.receipt?.transactions ?? []; track tx.hash) {
            <p>
              <a
                class="swap-history__tx-link"
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
            <p class="swap-history__details-note">
              Check your wallet before starting another exchange. Refresh only
              checks status; it never sends funds.
            </p>
          }
        </div>
      </details>
    </ng-template>
  `,
})
export class SwapHistoryComponent {
  @Input() compact = false;
  readonly history = inject(SwapHistoryFacade);

  onRefresh(event: Event): void {
    event.preventDefault();
    if ((event.currentTarget as HTMLButtonElement).disabled) {
      return;
    }
    this.history.retry();
  }

  formatAmount(value: string, decimals: number): string {
    return formatSwapAmountDisplay(atomicToDecimal(value, decimals), decimals);
  }

  paidAmount(item: SwapHistoryItem): string {
    return this.formatAmount(
      item.receipt?.amountIn ?? item.amountIn,
      item.sourceDecimals
    );
  }

  paidLabel(item: SwapHistoryItem): string {
    return item.receipt?.amountIn ? 'Settled' : 'Quoted';
  }

  receivedAmount(item: SwapHistoryItem): string {
    const settled =
      item.status === 'SUCCESS' && item.receipt?.amountOut
        ? item.receipt.amountOut
        : null;
    return this.formatAmount(
      settled ?? item.amountOut,
      item.destinationDecimals
    );
  }

  receivedLabel(item: SwapHistoryItem): string {
    return item.status === 'SUCCESS' && item.receipt?.amountOut
      ? 'Settled'
      : 'Quoted';
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
        return 'Failed';
      case 'INCOMPLETE_DEPOSIT':
        return 'Incomplete deposit';
      case 'KNOWN_DEPOSIT_TX':
        return 'Deposit detected';
      case 'PENDING_DEPOSIT':
        return 'Awaiting deposit confirmation';
      case 'PROCESSING':
        return 'Processing';
      default:
        return 'Status unknown';
    }
  }

  statusTone(item: SwapHistoryItem): 'success' | 'attention' | 'neutral' {
    switch (item.status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
      case 'INCOMPLETE_DEPOSIT':
      case 'UNKNOWN':
        return 'attention';
      default:
        return 'neutral';
    }
  }
}
