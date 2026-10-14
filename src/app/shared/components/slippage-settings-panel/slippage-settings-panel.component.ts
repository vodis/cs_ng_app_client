import {
  AfterViewInit,
  Component,
  DoCheck,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';
import {
  formatSlippagePercentLabel,
  isSlippagePresetBps,
  parseSlippagePercentInput,
  percentInputFromBps,
  sanitizeSlippagePercentInput,
  SLIPPAGE_PRESET_BPS,
  type SlippagePresetBps,
} from './slippage-settings.utils';
import { resolveAmountKeydownAction } from '@shared/utils/amount-format.utils';

export type SwapRouteMode = 'direct' | 'cross-chain';
export type SwapPrivacyMode = 'public' | 'confidential';

export interface SwapSettingsSelection {
  slippageToleranceBps: number;
  route: SwapRouteMode;
  privacy: SwapPrivacyMode;
}

@Component({
  selector: 'app-slippage-settings-panel',
  standalone: false,
  templateUrl: './slippage-settings-panel.component.html',
  styleUrls: ['./slippage-settings-panel.component.scss'],
})
export class SlippageSettingsPanelComponent
  implements DoCheck, AfterViewInit, OnDestroy
{
  private readonly overlay = inject(Overlay);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private overlayRef?: OverlayRef;
  private backdropSub?: Subscription;
  private pendingOpen = false;
  private wasOpen = false;

  @Input() isOpen = false;
  @Input() slippageToleranceBps = 50;
  @Input() receiveAtLeastLabel = '';
  @Input() limitLabel = 'Receive at least';
  @Input() maxSlippageBps = 1000;
  @Input() route: SwapRouteMode = 'direct';
  @Input() privacy: SwapPrivacyMode = 'public';
  @Input() directRouteEnabled = true;
  @Input() crossChainRouteEnabled = true;

  @Output() saveRequested = new EventEmitter<SwapSettingsSelection>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() draftBpsChanged = new EventEmitter<number>();

  @ViewChild('sheet') private sheet?: TemplateRef<void>;

  public readonly presets = SLIPPAGE_PRESET_BPS;
  public selectedPresetBps: SlippagePresetBps | null = 50;
  public customPercent = '';
  public validationError = '';
  public draftRoute: SwapRouteMode = 'direct';
  public draftPrivacy: SwapPrivacyMode = 'public';

  public ngDoCheck(): void {
    if (this.isOpen && !this.wasOpen) {
      this.syncFromSaved(this.slippageToleranceBps);
      this.pendingOpen = true;
      this.tryAttach();
    }
    if (!this.isOpen && (this.wasOpen || this.overlayRef)) {
      this.pendingOpen = false;
      this.disposeOverlay();
    }
    this.wasOpen = this.isOpen;
  }

  public ngAfterViewInit(): void {
    this.tryAttach();
  }

  public ngOnDestroy(): void {
    this.disposeOverlay();
  }

  public presetLabel(bps: number): string {
    return formatSlippagePercentLabel(bps);
  }

  public isPresetSelected(bps: number): boolean {
    return this.selectedPresetBps === bps;
  }

  public selectRoute(route: SwapRouteMode): void {
    if (route === 'direct' && !this.directRouteEnabled) return;
    if (route === 'cross-chain' && !this.crossChainRouteEnabled) return;
    this.draftRoute = route;
  }

  public selectPrivacy(privacy: SwapPrivacyMode): void {
    this.draftPrivacy = privacy;
  }

  public routeHint(): string {
    return this.draftRoute === 'direct'
      ? 'Both tokens stay on one network.'
      : 'You receive a token on another network.';
  }

  public privacyHint(): string {
    return this.draftPrivacy === 'public'
      ? 'Standard quote and activity.'
      : 'Ask for a private route when the venue supports it.';
  }

  public selectPreset(bps: SlippagePresetBps): void {
    this.selectedPresetBps = bps;
    this.customPercent = '';
    this.validationError = '';
    this.draftBpsChanged.emit(bps);
  }

  public onCustomInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    const sanitized = sanitizeSlippagePercentInput(target.value);
    if (target.value !== sanitized) {
      const selectionStart = target.selectionStart ?? sanitized.length;
      target.value = sanitized;
      const nextCaret = Math.min(selectionStart, sanitized.length);
      target.setSelectionRange(nextCaret, nextCaret);
    }
    this.customPercent = sanitized;
    this.selectedPresetBps = null;
    const parsed = this.parseCustom();
    if (parsed == null) {
      this.validationError = sanitized.trim()
        ? `Enter a slippage between 0.01% and ${this.maxSlippageBps / 100}%.`
        : '';
      return;
    }
    this.validationError = '';
    this.draftBpsChanged.emit(parsed);
  }

  public onCustomKeydown(event: KeyboardEvent): void {
    const action = resolveAmountKeydownAction(event);
    if (action === 'allow') {
      return;
    }
    if (action === 'decimal-separator') {
      if (/[.,]/.test(this.customPercent)) {
        event.preventDefault();
      }
      return;
    }
    event.preventDefault();
  }

  public focusCustom(): void {
    this.selectedPresetBps = null;
    if (!this.customPercent.trim()) {
      this.validationError = '';
      return;
    }
    const parsed = this.parseCustom();
    if (parsed == null) {
      this.validationError = `Enter a slippage between 0.01% and ${this.maxSlippageBps / 100}%.`;
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
      this.validationError = `Enter a slippage between 0.01% and ${this.maxSlippageBps / 100}%.`;
      return;
    }
    this.saveRequested.emit({
      slippageToleranceBps: bps,
      route: this.draftRoute,
      privacy: this.draftPrivacy,
    });
  }

  public close(): void {
    this.closeRequested.emit();
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (!this.isOpen) {
      return;
    }
    this.close();
  }

  public highSlippage(): boolean {
    return (this.draftBps() ?? 0) >= 300;
  }

  private tryAttach(): void {
    if (!this.pendingOpen || !this.sheet || this.overlayRef) return;
    this.pendingOpen = false;
    const position = this.overlay.position().global().centerHorizontally();
    this.overlayRef = this.overlay.create({
      hasBackdrop: true,
      backdropClass: 'swap-settings-backdrop',
      panelClass: 'swap-settings-pane',
      scrollStrategy: this.overlay.scrollStrategies.block(),
      positionStrategy: this.mobileSheet()
        ? position.bottom('0')
        : position.centerVertically(),
      width: this.mobileSheet() ? '100%' : '26rem',
      maxWidth: '100vw',
    });
    this.overlayRef.attach(
      new TemplatePortal(this.sheet, this.viewContainerRef)
    );
    this.backdropSub = this.overlayRef.backdropClick().subscribe(() => {
      this.close();
    });
    queueMicrotask(() => this.focusInitialControl());
  }

  private mobileSheet(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches
    );
  }

  private focusInitialControl(): void {
    this.overlayRef?.overlayElement
      .querySelector<HTMLButtonElement>('.swap-settings-sheet__close')
      ?.focus();
  }

  private disposeOverlay(): void {
    this.backdropSub?.unsubscribe();
    this.backdropSub = undefined;
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }

  private parseCustom(): number | null {
    const value = parseSlippagePercentInput(this.customPercent);
    return value !== null && value <= this.maxSlippageBps ? value : null;
  }

  private draftBps(): number | null {
    if (this.selectedPresetBps != null) {
      return this.selectedPresetBps <= this.maxSlippageBps
        ? this.selectedPresetBps
        : null;
    }
    return this.parseCustom();
  }

  private syncFromSaved(bps: number): void {
    this.validationError = '';
    this.draftRoute = this.route;
    this.draftPrivacy = this.privacy;
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
