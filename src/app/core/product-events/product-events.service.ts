import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type ProductEventStatus = 'attempted' | 'succeeded' | 'failed' | 'cancelled';

type ProductEventInput = {
  eventName: string;
  status: ProductEventStatus;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  reasonCode?: string;
  metadata?: Record<string, unknown>;
};

const ANONYMOUS_ID_KEY = 'cs_product_events_anonymous_id';

@Injectable({ providedIn: 'root' })
export class ProductEventsService {
  private fallbackAnonymousId?: string;

  constructor(private readonly httpClient: HttpClient) {}

  record(input: ProductEventInput): void {
    this.httpClient
      .post(`${environment.apiUrl}/api/v1/product-events`, {
        ...input,
        source: 'app-client',
        anonymousId: this.anonymousId(),
        metadata: this.sanitizeMetadata(input.metadata ?? {}),
      })
      .subscribe({ error: () => undefined });
  }

  reason(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120);
    }
    return 'unknown';
  }

  message(error: unknown): string | undefined {
    return error instanceof Error ? error.message : undefined;
  }

  private anonymousId(): string {
    try {
      const existing = window.localStorage.getItem(ANONYMOUS_ID_KEY);
      if (existing) {
        return existing;
      }
      const generated = this.generateAnonymousId();
      window.localStorage.setItem(ANONYMOUS_ID_KEY, generated);
      return generated;
    } catch {
      return (this.fallbackAnonymousId ??= this.generateAnonymousId());
    }
  }

  private generateAnonymousId(): string {
    return typeof window.crypto?.randomUUID === 'function'
      ? window.crypto.randomUUID()
      : `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    const denied = ['token', 'authorization', 'password', 'secret'];
    return Object.fromEntries(
      Object.entries(metadata)
        .filter(([key]) => !denied.some(deniedKey => key.toLowerCase().includes(deniedKey)))
        .slice(0, 40)
    );
  }
}
