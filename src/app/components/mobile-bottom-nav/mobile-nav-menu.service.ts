import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

/**
 * Coordinates the mobile main-nav drawer with its header trigger.
 * The panel stays in `app-mobile-bottom-nav`; the open control lives in the header.
 */
@Injectable({ providedIn: 'root' })
export class MobileNavMenuService {
  private readonly openSubject = new BehaviorSubject<boolean>(false);
  private readonly focusTriggerSubject = new Subject<void>();

  public readonly open$ = this.openSubject.asObservable();
  public readonly focusTrigger$ = this.focusTriggerSubject.asObservable();

  public get isOpen(): boolean {
    return this.openSubject.value;
  }

  public open(): void {
    if (!this.openSubject.value) {
      this.openSubject.next(true);
    }
  }

  public close(restoreTriggerFocus = false): void {
    if (this.openSubject.value) {
      this.openSubject.next(false);
    }

    if (restoreTriggerFocus) {
      queueMicrotask(() => this.focusTriggerSubject.next());
    }
  }

  public toggle(): void {
    if (this.openSubject.value) {
      this.close(true);
      return;
    }

    this.open();
  }
}
