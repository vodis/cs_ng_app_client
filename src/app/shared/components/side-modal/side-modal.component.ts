import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-side-modal',
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent {
  @Input() isOpen = false;
}
