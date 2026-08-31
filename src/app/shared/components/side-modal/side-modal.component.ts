import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';

@Component({
  selector: 'app-side-modal',
  standalone: false,
  templateUrl: 'side-modal.component.html',
  styleUrls: ['side-modal.component.scss'],
})
export class SideModalComponent implements AfterViewInit, OnDestroy {
  @Input() isOpen = false;
  @Input() placement: 'left' | 'right' = 'right';
  @Output() closeRequested = new EventEmitter<void>();
  @ViewChild('dialog') public dialog?: ElementRef<HTMLElement>;

  private readonly onDialogClickCapture = (event: Event): void => {
    if (!this.isOpen || !this.isCloseControl(event.target)) {
      return;
    }
    event.stopPropagation();
    this.closeRequested.emit();
  };

  public ngAfterViewInit(): void {
    this.dialog?.nativeElement.addEventListener(
      'click',
      this.onDialogClickCapture,
      true
    );
  }

  public ngOnDestroy(): void {
    this.dialog?.nativeElement.removeEventListener(
      'click',
      this.onDialogClickCapture,
      true
    );
  }

  public handleBackdropClick(): void {
    this.closeRequested.emit();
  }

  public handleDialogClick(event: Event): void {
    event.stopPropagation();
    if (!this.isOpen || !this.isCloseControl(event.target)) {
      return;
    }
    this.closeRequested.emit();
  }

  @HostListener('document:keydown.escape')
  public handleEscape(): void {
    if (!this.isOpen) {
      return;
    }
    this.closeRequested.emit();
  }

  private isCloseControl(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    return Boolean(
      target.closest(
        '.connect-wallet__close, [aria-label="Close wallet connection dialog"]'
      )
    );
  }
}
