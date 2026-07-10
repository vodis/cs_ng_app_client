import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-animate-title',
  standalone: false,
  templateUrl: './animate-title.component.html',
  styleUrls: ['./animate-title.component.scss'],
})
export class AnimateTitleComponent {
  @Input() public title = '';
}
