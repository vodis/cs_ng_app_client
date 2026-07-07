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
  filterTokensByQuery,
  resolveTokenSelectPanelViewModel,
  TokenSelectPanelViewModel,
} from './token-select-panel.utils';

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
  @Input() selectedSymbol = '';
  @Input() excludedSymbol = '';
  @Input() isOpen = false;

  @Output() tokenSelected = new EventEmitter<ExchangeToken>();
  @Output() closeRequested = new EventEmitter<void>();

  public filterQuery = '';

  public get availableTokens(): ExchangeToken[] {
    return this.tokens.filter(token => token.symbol !== this.excludedSymbol);
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

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.filterQuery = '';
    }
  }

  public handleSelect(token: ExchangeToken): void {
    this.filterQuery = '';
    this.tokenSelected.emit(token);
  }

  public handleClose(): void {
    this.filterQuery = '';
    this.closeRequested.emit();
  }
}
