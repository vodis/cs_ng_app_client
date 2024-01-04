import { Component, HostListener, OnInit } from '@angular/core';
import { Direction } from '@shared/components/animate-line/animate-line.component';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.scss'],
})
export class LayoutComponent implements OnInit {
  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public DirectionType = Direction;

  ngOnInit() {
    this.isMobileView = this.currentWidth <= 768;
  }

  @HostListener('window:resize', ['$event'])
  public onResize(event: Event) {
    this.currentWidth = (
      event as unknown as { target: Window }
    ).target.innerWidth;
    this.isMobileView = this.currentWidth <= 768;
  }
}
