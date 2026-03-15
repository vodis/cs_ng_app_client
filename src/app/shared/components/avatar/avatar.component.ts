import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  templateUrl: 'avatar.component.html',
  styleUrls: ['avatar.component.scss'],
})
export class AvatarComponent {
  @Input() img: string | null;
  @Input() alt: string;
  private hexValues = [
    '0',
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    'a',
    'b',
    'c',
    'd',
    'e',
  ];
  public randomBackground: string;

  constructor() {
    this.img = null;
    this.alt = 'Random image';
    this.randomBackground = this.getGradient();
  }

  private populate(a: string): string {
    for (let i = 0; i < 6; i++) {
      const x = Math.round(Math.random() * 14);
      const y = this.hexValues[x];
      a += y;
    }
    return a;
  }

  private getGradient(): string {
    const color1 = this.populate('#');
    const color2 = this.populate('#');
    const angle = Math.round(Math.random() * 360);
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }
}
