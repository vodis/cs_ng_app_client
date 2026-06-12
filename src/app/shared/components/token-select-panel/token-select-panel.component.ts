import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ExchangeToken } from '@shared/models/exchange-token.model';

@Component({
  selector: 'app-token-select-panel',
  standalone: false,
  templateUrl: './token-select-panel.component.html',
  styleUrls: ['./token-select-panel.component.scss'],
})
export class TokenSelectPanelComponent {
  @Input() title = 'Select token';
  @Input() tokens: ExchangeToken[] = [];
  @Input() loading = false;
  @Input() loadError = '';
  @Input() selectedSymbol = '';
  @Input() excludedSymbol = '';

  @Output() tokenSelected = new EventEmitter<ExchangeToken>();
  @Output() closeRequested = new EventEmitter<void>();

  public get availableTokens(): ExchangeToken[] {
    return this.tokens.filter(token => token.symbol !== this.excludedSymbol);
  }

  public handleSelect(token: ExchangeToken): void {
    this.tokenSelected.emit(token);
  }

  public handleClose(): void {
    this.closeRequested.emit();
  }
}
