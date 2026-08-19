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

type ProductEventContext = {
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
};

const ANONYMOUS_ID_KEY = 'cs_product_events_anonymous_id';

@Injectable({ providedIn: 'root' })
export class ProductEventsService {
  private fallbackAnonymousId?: string;

  constructor(private readonly httpClient: HttpClient) {}

  record(input: ProductEventInput): void {
    const url = `${environment.apiUrl}/api/v1/product-events`;
    this.httpClient
      .post(url, {
        ...input,
        source: 'app-client',
        anonymousId: this.anonymousId(),
        metadata: this.sanitizeMetadata(input.metadata ?? {}),
      })
      .subscribe({
        error: error => {
          if (this.needsDeliveryVisibility(input)) {
            this.warnTelemetryDelivery(url, this.errorStatus(error));
          }
        },
      });
  }

  recordFailure(
    eventName: string,
    error: unknown,
    context: ProductEventContext = {}
  ): void {
    this.record({
      eventName,
      status: 'failed',
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId,
      reasonCode: this.reason(error),
      metadata: {
        message: this.message(error),
        ...context.metadata,
      },
    });
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

  private sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    const denied = [
      'token',
      'authorization',
      'password',
      'secret',
      'code',
      'verifier',
      'credential',
    ];
    return Object.fromEntries(
      Object.entries(metadata)
        .filter(
          ([key]) =>
            !denied.some(deniedKey => key.toLowerCase().includes(deniedKey))
        )
        .slice(0, 40)
        .map(([key, value]) => [key, this.sanitizeValue(value, denied, 0)])
    );
  }

  private sanitizeValue(
    value: unknown,
    denied: string[],
    depth: number
  ): unknown {
    if (depth >= 4) return '[truncated]';
    if (Array.isArray(value)) {
      return value
        .slice(0, 40)
        .map(item => this.sanitizeValue(item, denied, depth + 1));
    }
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(
          ([key]) =>
            !denied.some(deniedKey => key.toLowerCase().includes(deniedKey))
        )
        .slice(0, 40)
        .map(([key, nested]) => [
          key,
          this.sanitizeValue(nested, denied, depth + 1),
        ])
    );
  }

  private needsDeliveryVisibility(input: ProductEventInput): boolean {
    return (
      (input.status === 'failed' || input.status === 'cancelled') &&
      input.eventName === 'auth.login'
    );
  }

  private errorStatus(error: unknown): number | 'network_error' {
    if (
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status > 0
    ) {
      return error.status;
    }
    return 'network_error';
  }

  private warnTelemetryDelivery(
    url: string,
    status: number | 'network_error'
  ): void {
    console.warn(
      `product telemetry delivery failed url=${url} status=${status}`
    );
  }
}
