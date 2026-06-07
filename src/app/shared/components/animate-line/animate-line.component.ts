import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';

export enum Direction {
  Column = 'column',
  Row = 'row',
}

@Component({
  selector: 'app-animate-line',
  standalone: false,
  templateUrl: './animate-line.component.html',
  styleUrls: ['./animate-line.component.scss'],
})
export class AnimateLineComponent implements OnChanges {
  readonly Direction = Direction;

  @Input() public direction: Direction = Direction.Column;
  @Input() public duration = 0.5;
  @Input() public size?: string;
  @Input() public resetKey = 0;

  @Output() public animationComplete = new EventEmitter<void>();

  public isAnimating = true;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['resetKey'] && !changes['resetKey'].firstChange) {
      this.isAnimating = true;
    }
  }

  public onAnimationEnd(): void {
    if (!this.isAnimating) {
      return;
    }

    this.isAnimating = false;
    this.animationComplete.emit();
  }
}
