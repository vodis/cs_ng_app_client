import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import {
  networkLabel,
  destinationMemoError,
  recipientAddressError,
} from '@shared/utils/network.utils';

@Component({
  selector: 'app-recipient-address-panel',
  standalone: false,
  templateUrl: './recipient-address-panel.component.html',
  styleUrls: ['./recipient-address-panel.component.scss'],
})
export class RecipientAddressPanelComponent implements OnChanges {
  @Input() blockchain = '';
  @Input() address = '';
  @Input() destinationMemo = '';
  @Output() memoSaved = new EventEmitter<string>();
  @Input() isOpen = false;
  @Output() addressSaved = new EventEmitter<string>();
  @Output() closeRequested = new EventEmitter<void>();

  public draftAddress = '';
  public draftMemo = '';
  public validationError = '';

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.draftAddress = this.address;
      this.draftMemo = this.destinationMemo;
      this.validationError = '';
    }
  }

  public networkName(): string {
    return networkLabel(this.blockchain);
  }

  public save(): void {
    this.validationError = recipientAddressError(
      this.blockchain,
      this.draftAddress
    );
    this.validationError ||= destinationMemoError(
      this.blockchain,
      this.draftMemo.trim(),
      this.draftAddress.trim()
    );
    if (this.validationError) return;
    this.memoSaved.emit(this.draftMemo.trim());
    this.addressSaved.emit(this.draftAddress.trim());
  }

  public close(): void {
    this.closeRequested.emit();
  }
}
