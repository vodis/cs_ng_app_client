import { Component, Input } from '@angular/core';
import { PortfolioPosition, PortfolioSnapshot } from './portfolio.models';

const POSITION_COLORS = ['#43e6a0', '#7c8cff', '#ffb84d', '#ff6b8a', '#45b7e8'];

@Component({
  selector: 'app-portfolio-holdings',
  standalone: false,
  templateUrl: './portfolio-holdings.component.html',
  styleUrls: ['./portfolio-holdings.component.scss'],
})
export class PortfolioHoldingsComponent {
  @Input({ required: true }) snapshot!: PortfolioSnapshot;

  positionColor(index: number): string {
    return POSITION_COLORS[index % POSITION_COLORS.length];
  }

  currency(value: string | null): string {
    if (value === null) return 'Unpriced';
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        })
      : '$—';
  }

  quantity(position: PortfolioPosition): string {
    const value = Number(position.quantity);
    return Number.isFinite(value)
      ? `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${position.symbol}`
      : `${position.quantity} ${position.symbol}`;
  }

  percent(position: PortfolioPosition): string {
    return position.allocationPercent === null
      ? '—'
      : `${Number(position.allocationPercent).toFixed(1)}%`;
  }

  label(value: string): string {
    return value
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  trackPosition(_index: number, item: PortfolioPosition): string {
    return `${item.walletRef}:${item.assetId}`;
  }
}
