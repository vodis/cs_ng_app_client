import {
  Component,
  EventEmitter,
  HostListener,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-side-modal',
  standalone: false,
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent {
  @Input() isOpen = false;
  @Input() placement: 'left' | 'right' = 'right';
  @Input() showCloseButton = true;
  @Output() closeRequested = new EventEmitter<void>();

  public handleHostClose(event: Event): void {
    event.stopPropagation();
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  public handleBackdropClick(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  public handleDialogClick(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }
}
