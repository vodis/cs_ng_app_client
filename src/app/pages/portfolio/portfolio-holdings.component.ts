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

  allocationGradient(): string {
    const valued = this.snapshot.positions.filter(
      position => Number(position.allocationPercent) > 0
    );
    let offset = 0;
    const stops = valued.map((position, index) => {
      const start = offset;
      offset += Math.max(0, Math.min(100, Number(position.allocationPercent)));
      return `${this.positionColor(index)} ${start}% ${offset}%`;
    });
    return stops.length
      ? `conic-gradient(${stops.join(',')})`
      : 'conic-gradient(var(--gray-80) 0 100%)';
  }

  currency(value: string | null): string {
    if (value === null) return 'Unpriced';
    const parsed = Number(value);
    return Number.isFinite(parsed)
      ? parsed.toLocaleString(undefined, {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 2,
        })
      : '$—';
  }

  quantity(position: PortfolioPosition): string {
    const value = Number(position.quantity);
    return Number.isFinite(value)
      ? `${value.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${position.symbol}`
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

  date(value: string): string {
    return new Date(value).toLocaleString();
  }

  trackPosition(_index: number, item: PortfolioPosition): string {
    return `${item.walletRef}:${item.assetId}`;
  }
}
