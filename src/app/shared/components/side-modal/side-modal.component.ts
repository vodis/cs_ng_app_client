import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-side-modal',
  standalone: false,
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent {
  @Input() isOpen = false;
  @Input() placement: 'left' | 'right' = 'right';
  @Output() closeRequested = new EventEmitter<void>();

  public handleBackdropClick(): void {
    this.closeRequested.emit();
  }
}
