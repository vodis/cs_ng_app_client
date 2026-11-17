import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: 'avatar.component.html',
  styleUrls: ['avatar.component.scss'],
})
export class AvatarComponent implements OnChanges {
  @Input() img: string | null = null;
  @Input() alt = 'Account';
  /** Stable id/email — same seed always yields the same fallback colors. */
  @Input() seed: string | null = null;
  /** Used for initials when no photo is available. */
  @Input() label: string | null = null;

  public background = this.randomGradient();
  public initials = '?';
  public showImage = false;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['seed'] || changes['label'] || changes['img']) {
      this.background = this.seed
        ? this.gradientFromSeed(this.seed)
        : this.randomGradient();
      this.initials = initialsFromLabel(this.label || this.alt || this.seed);
      this.showImage = Boolean(this.img && /^https?:\/\//i.test(this.img));
    }
  }

  public onImageError(): void {
    this.showImage = false;
  }

  private randomGradient(): string {
    return this.buildGradient(
      this.randomHexColor(),
      this.randomHexColor(),
      Math.round(Math.random() * 360)
    );
  }

  private gradientFromSeed(seed: string): string {
    const hash = this.hashString(seed);
    const color1 = this.hexFromHash(hash);
    const color2 = this.hexFromHash(hash >>> 8);
    const angle = hash % 360;
    return this.buildGradient(color1, color2, angle);
  }

  private buildGradient(color1: string, color2: string, angle: number): string {
    return `linear-gradient(${angle}deg, ${color1}, ${color2})`;
  }

  private randomHexColor(): string {
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += '0123456789abcdef'[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  private hexFromHash(hash: number): string {
    const value = hash >>> 0;
    return `#${(value & 0xffffff).toString(16).padStart(6, '0')}`;
  }

  private hashString(value: string): number {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
}

function initialsFromLabel(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    return '?';
  }

  if (trimmed.includes('@')) {
    const local = trimmed.split('@')[0] ?? trimmed;
    const parts = local.split(/[._\-\s]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
