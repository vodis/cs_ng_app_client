import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ElementRef,
  ViewChild,
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
import {
  groupTokens,
  summarizeHoldings,
  type TokenGroup,
} from './token-groups.utils';
import type { LinkedTokenHolding } from '@domains/wallet/application/linked-wallet-balances.facade';
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
  @Input() walletTokensLoading = false;
  @Input() isOpen = false;

  @Input() holdings: LinkedTokenHolding[] = [];
  @Input() fundingSelection = false;
  @Input() selectionBusy = false;
  @Input() selectionError = '';
  @Input() balancesIncomplete = false;
  @Output() fundingSelected = new EventEmitter<LinkedTokenHolding>();
  @Output() retryRequested = new EventEmitter<void>();
  @ViewChild('stepTitle') private stepTitle?: ElementRef<HTMLElement>;
  public groupSymbol: string | null = null;

  @Output() tokenSelected = new EventEmitter<ExchangeToken>();
  @Output() closeRequested = new EventEmitter<void>();

  public filterQuery = '';

  public get availableTokens(): ExchangeToken[] {
    return this.tokens.filter(token => token.assetId !== this.excludedAssetId);
  }

  public get filteredTokens(): ExchangeToken[] {
    return filterTokensByQuery(this.availableTokens, this.filterQuery);
  }

  public get viewModel(): TokenSelectPanelViewModel {
    return resolveTokenSelectPanelViewModel({
      loading: this.loading,
      loadError: this.loadError,
      availableTokenCount: this.availableTokens.length,
    });
  }

  public get groups(): TokenGroup[] {
    const matching = new Set(this.filteredTokens.map(token => token.assetId));
    return groupTokens(this.availableTokens).filter(group =>
      group.tokens.some(token => matching.has(token.assetId))
    );
  }

  public get selectedGroup(): TokenGroup | undefined {
    return groupTokens(this.availableTokens).find(
      group => group.symbol === this.groupSymbol
    );
  }

  public holdingsFor(tokens: ExchangeToken[]): LinkedTokenHolding[] {
    const ids = new Set(tokens.map(token => token.assetId));
    return this.holdings.filter(holding => ids.has(holding.token.assetId));
  }

  public balanceSummary(tokens: ExchangeToken[]) {
    return summarizeHoldings(this.holdingsFor(tokens));
  }

  public holdingSummary(holding: LinkedTokenHolding) {
    return summarizeHoldings([holding]);
  }

  public groupSelected(group: TokenGroup): boolean {
    return group.tokens.some(token => token.assetId === this.selectedAssetId);
  }

  public openGroup(group: TokenGroup): void {
    this.groupSymbol = group.symbol;
    setTimeout(() => this.stepTitle?.nativeElement.focus());
  }

  public back(): void {
    this.groupSymbol = null;
    setTimeout(() => this.stepTitle?.nativeElement.focus());
  }

  public chooseHolding(holding: LinkedTokenHolding): void {
    if (!this.selectionBusy) this.fundingSelected.emit(holding);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.filterQuery = '';
      this.groupSymbol = null;
    }
    if (this.groupSymbol && !this.selectedGroup) this.groupSymbol = null;
  }

  public handleSelect(token: ExchangeToken): void {
    if (this.selectionBusy) return;
    this.filterQuery = '';
    this.tokenSelected.emit(token);
  }

  public networkName(token: ExchangeToken): string {
    return networkLabel(token.blockchain);
  }

  public tokenNetworkLabel(token: ExchangeToken): string {
    return `${token.displaySymbol || token.symbol}_${this.networkName(token)}`;
  }

  public handleClose(): void {
    this.filterQuery = '';
    this.groupSymbol = null;
    this.closeRequested.emit();
  }

  public resolveTokenIcon(token: ExchangeToken): string {
    return resolveExchangeTokenIconUrl(token);
  }

  public avatarFallback(token: ExchangeToken): string {
    return tokenAvatarFallback(tokenAvatarLabel(token));
  }
}
