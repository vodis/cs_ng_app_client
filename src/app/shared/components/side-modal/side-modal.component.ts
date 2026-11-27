import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';

@Component({
  selector: 'app-side-modal',
  standalone: false,
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent implements OnInit, OnChanges, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);
  private previouslyFocused: HTMLElement | null = null;

  @Input() isOpen = false;
  @Input() placement: 'left' | 'right' = 'right';
  @Input() showCloseButton = true;
  /** Keep panel overflow hidden so nested surfaces (swap-review) own scrolling. */
  @Input() containScroll = false;
  /** Narrow right drawer (~480–520px) for flows like Add Funds. */
  @Input() size: 'drawer' | 'compact' = 'drawer';
  /** Optional id of a heading inside the drawer for the dialog accessible name. */
  @Input() ariaLabelledBy: string | null = null;
  @Output() closeRequested = new EventEmitter<void>();

  public ngOnInit(): void {
    // Escape the page stacking context (content router z-index: 1 vs sidebar
    // z-index: 3) so fixed backdrop/panel cover the desktop shell rail.
    this.document.body.appendChild(this.elementRef.nativeElement);
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (!changes['isOpen']) {
      return;
    }
    if (this.isOpen) {
      this.rememberOpenerFocus();
      return;
    }
    if (changes['isOpen'].previousValue === true) {
      this.restoreOpenerFocus();
    }
  }

  public ngOnDestroy(): void {
    this.elementRef.nativeElement.remove();
    this.previouslyFocused = null;
  }

  public handleHostClose(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  public handleBackdropClick(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  public handleDialogClick(event: Event): void {
    event.stopPropagation();
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  private rememberOpenerFocus(): void {
    const active = this.document.activeElement;
    this.previouslyFocused = active instanceof HTMLElement ? active : null;
  }

  private restoreOpenerFocus(): void {
    const target = this.previouslyFocused;
    this.previouslyFocused = null;
    if (!target || !this.document.contains(target)) {
      return;
    }
    queueMicrotask(() => {
      target.focus({ preventScroll: true });
    });
  }
}
