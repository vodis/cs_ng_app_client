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
import { WalletTokenOption } from './token-select-panel.models';
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
  @Input() showWalletTokens = false;
  @Input() walletTokens: WalletTokenOption[] = [];
  @Input() walletTokensLoading = false;
  @Input() walletTokensError = '';
  @Input() isOpen = false;

  @Output() tokenSelected = new EventEmitter<ExchangeToken>();
  @Output() closeRequested = new EventEmitter<void>();

  public filterQuery = '';

  public get availableTokens(): ExchangeToken[] {
    return this.tokens.filter(token => token.assetId !== this.excludedAssetId);
  }

  public get filteredTokens(): ExchangeToken[] {
    return filterTokensByQuery(this.availableTokens, this.filterQuery);
  }

  public get filteredWalletTokens(): WalletTokenOption[] {
    const availableAssetIds = new Set(
      this.filteredTokens.map(token => token.assetId)
    );
    return this.walletTokens.filter(option =>
      availableAssetIds.has(option.token.assetId)
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
    }
  }

  public handleSelect(token: ExchangeToken): void {
    this.emitSelection(token);
  }

  public handleWalletTokenSelect(option: WalletTokenOption): void {
    this.emitSelection(option.token);
  }

  public networkName(token: ExchangeToken): string {
    return networkLabel(token.blockchain);
  }

  public tokenNetworkLabel(token: ExchangeToken): string {
    return `${token.displaySymbol || token.symbol}_${this.networkName(token)}`;
  }

  private emitSelection(token: ExchangeToken): void {
    this.filterQuery = '';
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
