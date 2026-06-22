import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '@core/auth/auth-session.service';
import type { AuthSession } from '@core/auth/auth-session.types';

@Component({
  selector: 'app-profile',
  standalone: false,
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit, OnDestroy {
  public session: AuthSession | null = null;
  public deletionMessage = '';
  public error = '';

  private subscription?: Subscription;

  constructor(public readonly authSession: AuthSessionService) {}

  public ngOnInit(): void {
    this.subscription = this.authSession.session$.subscribe(session => {
      this.session = session;
    });
  }

  public ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  public shortAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  public async requestDeletion(): Promise<void> {
    this.error = '';
    this.deletionMessage = '';
    try {
      const deletionAvailableAt = await this.authSession.requestDeletion();
      this.deletionMessage = `Deletion available ${new Date(deletionAvailableAt).toLocaleDateString()}`;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Account deletion failed';
    }
  }
}
