import { Component, HostListener, OnInit } from '@angular/core';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  public currentWidth = window.innerWidth;
  public isMobileView = false;
  public originUrl: string = environment.origin;

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
