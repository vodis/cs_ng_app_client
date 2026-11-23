import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';

@Component({
  selector: 'app-side-modal',
  standalone: false,
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent implements OnInit, OnDestroy {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly document = inject(DOCUMENT);

  @Input() isOpen = false;
  @Input() placement: 'left' | 'right' = 'right';
  @Input() showCloseButton = true;
  /** Keep panel overflow hidden so nested surfaces (swap-review) own scrolling. */
  @Input() containScroll = false;
  /** Narrow right drawer (~480–520px) for flows like Add Funds. */
  @Input() size: 'drawer' | 'compact' = 'drawer';
  @Output() closeRequested = new EventEmitter<void>();

  public ngOnInit(): void {
    // Escape the page stacking context (content router z-index: 1 vs sidebar
    // z-index: 3) so fixed backdrop/panel cover the desktop shell rail.
    this.document.body.appendChild(this.elementRef.nativeElement);
  }

  public ngOnDestroy(): void {
    this.elementRef.nativeElement.remove();
  }

  public handleHostClose(event: Event): void {
    event.stopPropagation();
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
}
