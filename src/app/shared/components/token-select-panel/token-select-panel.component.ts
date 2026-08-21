import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import {
  resolveExchangeTokenIconUrl,
  tokenAvatarFallback,
  tokenAvatarLabel,
} from '@shared/utils/token-avatar.utils';
import {
  filterTokensByQuery,
  resolveTokenSelectPanelViewModel,
  TokenSelectPanelViewModel,
} from './token-select-panel.utils';
import { networkLabel } from '@shared/utils/network.utils';

@Component({
  selector: 'app-token-select-panel',
  standalone: false,
  templateUrl: './token-select-panel.component.html',
  styleUrls: ['./token-select-panel.component.scss'],
})
export class TokenSelectPanelComponent implements OnChanges {
  @Input() title = 'Select token';
  @Input() tokens: ExchangeToken[] = [];
  @Input() loading = false;
  @Input() loadError = '';
  @Input() selectedAssetId = '';
  @Input() excludedAssetId = '';
  @Input() showNetworkStep = false;
  @Input() isOpen = false;

  @Output() tokenSelected = new EventEmitter<ExchangeToken>();
  @Output() closeRequested = new EventEmitter<void>();

  public filterQuery = '';
  public pendingSymbol = '';

  public get availableTokens(): ExchangeToken[] {
    return this.tokens.filter(token => token.assetId !== this.excludedAssetId);
  }

  public get filteredTokens(): ExchangeToken[] {
    return filterTokensByQuery(this.availableTokens, this.filterQuery);
  }

  public get assetOptions(): ExchangeToken[] {
    const bySymbol = new Map<string, ExchangeToken>();
    for (const token of this.filteredTokens) {
      const key = token.displaySymbol || token.symbol;
      if (!bySymbol.has(key)) bySymbol.set(key, token);
    }
    return Array.from(bySymbol.values());
  }

  public get networkOptions(): ExchangeToken[] {
    return this.availableTokens.filter(
      token => (token.displaySymbol || token.symbol) === this.pendingSymbol
    );
  }

  public get viewModel(): TokenSelectPanelViewModel {
    return resolveTokenSelectPanelViewModel({
      loading: this.loading,
      loadError: this.loadError,
      availableTokenCount: this.availableTokens.length,
    });
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.filterQuery = '';
      this.pendingSymbol = '';
    }
  }

  public handleSelect(token: ExchangeToken): void {
    if (this.showNetworkStep) {
      this.pendingSymbol = token.displaySymbol || token.symbol;
      this.filterQuery = '';
      return;
    }
    this.emitSelection(token);
  }

  public handleNetworkSelect(token: ExchangeToken): void {
    this.emitSelection(token);
  }

  public handleBack(): void {
    this.pendingSymbol = '';
  }

  public networkName(token: ExchangeToken): string {
    return networkLabel(token.blockchain);
  }

  public assetNetworkSummary(token: ExchangeToken): string {
    const symbol = token.displaySymbol || token.symbol;
    const count = this.availableTokens.filter(
      item => (item.displaySymbol || item.symbol) === symbol
    ).length;
    return count > 1 ? `${count} networks` : this.networkName(token);
  }

  public isAssetSelected(token: ExchangeToken): boolean {
    const selected = this.tokens.find(
      item => item.assetId === this.selectedAssetId
    );
    return Boolean(
      selected &&
      (selected.displaySymbol || selected.symbol) ===
        (token.displaySymbol || token.symbol)
    );
  }

  private emitSelection(token: ExchangeToken): void {
    this.filterQuery = '';
    this.pendingSymbol = '';
    this.tokenSelected.emit(token);
  }

  public handleClose(): void {
    this.filterQuery = '';
    this.closeRequested.emit();
  }

  public resolveTokenIcon(token: ExchangeToken): string {
    return resolveExchangeTokenIconUrl(token);
  }

  public avatarFallback(token: ExchangeToken): string {
    return tokenAvatarFallback(tokenAvatarLabel(token));
  }
}
