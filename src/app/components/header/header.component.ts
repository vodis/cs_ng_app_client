import { Component, HostListener } from '@angular/core';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent {
  public currentWidth = window.innerWidth;
  public isMobileView = false;

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
