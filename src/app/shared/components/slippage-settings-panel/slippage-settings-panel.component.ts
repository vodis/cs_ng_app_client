import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import {
  formatSlippagePercentLabel,
  isSlippagePresetBps,
  parseSlippagePercentInput,
  percentInputFromBps,
  SLIPPAGE_PRESET_BPS,
  type SlippagePresetBps,
} from './slippage-settings.utils';

@Component({
  selector: 'app-slippage-settings-panel',
  standalone: false,
  templateUrl: './slippage-settings-panel.component.html',
  styleUrls: ['./slippage-settings-panel.component.scss'],
})
export class SlippageSettingsPanelComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() slippageToleranceBps = 50;
  @Input() receiveAtLeastLabel = '';

  @Output() saveRequested = new EventEmitter<number>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() draftBpsChanged = new EventEmitter<number>();

  @ViewChild('dialog') private readonly dialog?: ElementRef<HTMLElement>;
  @ViewChild('closeButton')
  private readonly closeButton?: ElementRef<HTMLButtonElement>;

  public readonly presets = SLIPPAGE_PRESET_BPS;
  public selectedPresetBps: SlippagePresetBps | null = 50;
  public customPercent = '';
  public validationError = '';

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen']?.currentValue === true) {
      this.syncFromSaved(this.slippageToleranceBps);
      queueMicrotask(() => this.focusInitialControl());
    }
  }

  public presetLabel(bps: number): string {
    return formatSlippagePercentLabel(bps);
  }

  public isPresetSelected(bps: number): boolean {
    return this.selectedPresetBps === bps;
  }

  public selectPreset(bps: SlippagePresetBps): void {
    this.selectedPresetBps = bps;
    this.customPercent = '';
    this.validationError = '';
    this.draftBpsChanged.emit(bps);
  }

  public onCustomInput(event: Event): void {
    const target = event.target;
    const raw = target instanceof HTMLInputElement ? target.value : '';
    this.customPercent = raw;
    this.selectedPresetBps = null;
    const parsed = parseSlippagePercentInput(raw);
    if (parsed == null) {
      this.validationError = raw.trim()
        ? 'Enter a slippage between 0.01% and 50%.'
        : '';
      return;
    }
    this.validationError = '';
    this.draftBpsChanged.emit(parsed);
  }

  public focusCustom(): void {
    this.selectedPresetBps = null;
    if (!this.customPercent.trim()) {
      this.customPercent = percentInputFromBps(this.slippageToleranceBps);
    }
    const parsed = parseSlippagePercentInput(this.customPercent);
    if (parsed == null) {
      this.validationError = this.customPercent.trim()
        ? 'Enter a slippage between 0.01% and 50%.'
        : '';
      return;
    }
    this.validationError = '';
    this.draftBpsChanged.emit(parsed);
  }

  public canSave(): boolean {
    return this.draftBps() != null && !this.validationError;
  }

  public save(): void {
    const bps = this.draftBps();
    if (bps == null) {
      this.validationError = 'Enter a slippage between 0.01% and 50%.';
      return;
    }
    this.saveRequested.emit(bps);
  }

  public close(): void {
    this.closeRequested.emit();
  }

  public onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (!this.isOpen) {
      return;
    }
    this.close();
  }

  private focusInitialControl(): void {
    const closeButton = this.closeButton?.nativeElement;
    if (closeButton) {
      closeButton.focus();
      return;
    }
    this.dialog?.nativeElement.focus();
  }

  private draftBps(): number | null {
    if (this.selectedPresetBps != null) {
      return this.selectedPresetBps;
    }
    return parseSlippagePercentInput(this.customPercent);
  }

  private syncFromSaved(bps: number): void {
    this.validationError = '';
    if (isSlippagePresetBps(bps)) {
      this.selectedPresetBps = bps;
      this.customPercent = '';
    } else {
      this.selectedPresetBps = null;
      this.customPercent = percentInputFromBps(bps);
    }
    this.draftBpsChanged.emit(bps);
  }
}
