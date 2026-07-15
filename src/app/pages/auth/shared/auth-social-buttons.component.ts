import { Component, EventEmitter, Input, Output } from '@angular/core';

export type AuthSocialMethod = 'passkey' | 'google' | 'apple' | 'telegram';

@Component({
  selector: 'app-auth-social-buttons',
  standalone: false,
  templateUrl: './auth-social-buttons.component.html',
})
export class AuthSocialButtonsComponent {
  @Input() public disabled = false;
  @Input() public methods: AuthSocialMethod[] = ['google', 'apple'];
  @Input() public disabledMethods: AuthSocialMethod[] = [];

  @Output() public methodSelected = new EventEmitter<AuthSocialMethod>();

  public isEnabled(method: AuthSocialMethod): boolean {
    return this.methods.includes(method);
  }

  public isMethodDisabled(method: AuthSocialMethod): boolean {
    return this.disabled || this.disabledMethods.includes(method);
  }

  public select(method: AuthSocialMethod): void {
    if (this.isMethodDisabled(method)) {
      return;
    }

    this.methodSelected.emit(method);
  }
}
