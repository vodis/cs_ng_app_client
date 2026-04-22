import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-wallet-account',
  standalone: true,
  templateUrl: 'wallet-account.component.html',
})
export class WalletAccountComponent implements OnChanges {
  @Input() account: string = '';
  @Output() accountClick = new EventEmitter<void>();
  public shortAccount: string = '';

  ngOnChanges() {
    this.shortAccount = `${this.account.substring(0, 7)}...${this.account.substring(this.account.length - 5)}`;
  }

  public handleAccountClick(): void {
    this.accountClick.emit();
  }
}
