import { Component, Input, OnInit } from '@angular/core';

export enum Direction {
  Column = 'column',
  Row = 'row',
}

@Component({
  selector: 'app-animate-line',
  templateUrl: './animate-line.component.html',
  styleUrls: ['./animate-line.component.scss'],
})
export class AnimateLineComponent implements OnInit {
  @Input() public direction: Direction = Direction.Column;
  @Input() public duration = 0.5;

  public svgWidth: number | string = 0;
  public svgHeight: number | string = 0;
  public rectValue: string = '100vw';
  public animateAttributeName: string = 'width';

  public ngOnInit(): void {
    if (this.direction === Direction.Column) {
      this.columAnimation();
    } else {
      this.rowAnimation();
    }
  }

  private columAnimation(): void {
    this.svgWidth = this.rectValue = '100vw';
    this.svgHeight = 1;
    this.animateAttributeName = 'width';
  }

  private rowAnimation(): void {
    this.svgHeight = this.rectValue = '100vh';
    this.svgWidth = 1;
    this.animateAttributeName = 'height';
  }
}
