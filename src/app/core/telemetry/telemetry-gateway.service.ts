import { Inject, Injectable, InjectionToken, OnDestroy } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { toRouteTemplate } from './telemetry-route';
import type {
  TelemetryBatch,
  TelemetryEvent,
  TelemetryEventName,
  TelemetryProperties,
  TelemetryStatus,
} from './telemetry.types';

/** Feature flag `telemetryGateway` (off by default). */
export const TELEMETRY_GATEWAY_ENABLED = new InjectionToken<boolean>(
  'TELEMETRY_GATEWAY_ENABLED',
  {
    providedIn: 'root',
    factory: () =>
      (environment as { telemetryGateway?: boolean }).telemetryGateway === true,
  }
);

export const TELEMETRY_FLUSH_INTERVAL_MS = 5_000;
export const TELEMETRY_FLUSH_THRESHOLD = 20;
export const TELEMETRY_MAX_BATCH_SIZE = 50;
export const TELEMETRY_RETRY_DELAY_MS = 2_000;
export const TELEMETRY_ANON_ID_ROTATION_MS = 30 * 24 * 60 * 60 * 1000;
export const TELEMETRY_ANON_ID_KEY = 'cs_telemetry_anonymous_id';
const MAX_QUEUE_SIZE = 500;
const MAX_PROPERTY_LENGTH = 40;
/** Short slug-like values only; rejects emails, addresses and account names. */
const SAFE_PROPERTY_VALUE = /^[A-Za-z0-9_\-/[\]]+$/;
const LONG_HEX = /^(?:0x)?[0-9a-fA-F]{16,}$/;
const PROPERTY_KEYS = [
  'route',
  'network',
  'wallet_type',
  'error_category',
] as const;

export function telemetryErrorCategory(error: unknown): string {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`.toLowerCase()
      : '';
  if (/cancel|abort|denied|reject|dismiss/.test(text)) return 'cancelled';
  if (/network|fetch|timeout|offline|unreachable/.test(text)) return 'network';
  if (/unavailable|unsupported|not.?found/.test(text)) return 'unavailable';
  return 'unknown';
}

/**
 * First-party, best-effort product analytics sent to our own backend. Does
 * nothing unless the `telemetryGateway` flag is on and the browser does not
 * signal Global Privacy Control / Do-Not-Track. Never throws, never blocks the
 * caller and never surfaces errors.
 */
@Injectable({ providedIn: 'root' })
export class TelemetryGateway implements OnDestroy {
  private readonly url = `${environment.apiUrl}/api/v1/product-events/batch`;
  private queue: TelemetryEvent[] = [];
  private timer?: ReturnType<typeof setTimeout>;
  private subscription?: Subscription;
  private started = false;
  private fallbackAnonymousId?: { id: string; createdAt: number };

  constructor(
    private readonly router: Router,
    @Inject(TELEMETRY_GATEWAY_ENABLED) private readonly enabled: boolean
  ) {}

  /** Starts page-view capture and page-hide flushing. Safe to call twice. */
  init(): void {
    if (this.started || !this.enabled) return;
    this.started = true;
    try {
      this.subscription = this.router.events
        .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
        .subscribe(e => this.pageView(e.urlAfterRedirects));
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      window.addEventListener('pagehide', this.onPageHide);
    } catch {
      /* best effort */
    }
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
    this.clearTimer();
    if (this.started) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('pagehide', this.onPageHide);
    }
  }

  pageView(url: string): void {
    this.track('page.view', 'success', { route: toRouteTemplate(url) });
  }

  track(
    name: TelemetryEventName,
    status: TelemetryStatus,
    properties: Record<string, unknown> = {}
  ): void {
    try {
      if (!this.canSend()) {
        this.queue = [];
        this.clearTimer();
        return;
      }
      if (this.queue.length >= MAX_QUEUE_SIZE) this.queue.shift();
      this.queue.push({
        event_id: this.uuid(),
        name,
        status,
        occurred_at: new Date().toISOString(),
        anonymous_id: this.anonymousId(),
        properties: this.sanitize(properties),
      });
      if (this.queue.length >= TELEMETRY_FLUSH_THRESHOLD) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => {
          this.timer = undefined;
          this.flush();
        }, TELEMETRY_FLUSH_INTERVAL_MS);
      }
    } catch {
      /* best effort */
    }
  }

  /** Sends everything queued, at most 50 events per request. */
  flush(): void {
    this.sendQueued(false);
  }

  private sendQueued(unloading: boolean): void {
    try {
      this.clearTimer();
      if (!this.canSend()) {
        this.queue = [];
        return;
      }
      while (this.queue.length > 0) {
        const events = this.queue.splice(0, TELEMETRY_MAX_BATCH_SIZE);
        const body = JSON.stringify({ events } satisfies TelemetryBatch);
        if (unloading) this.sendOnUnload(body);
        else void this.send(body, true);
      }
    } catch {
      /* best effort */
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.sendQueued(true);
  };

  private readonly onPageHide = (): void => this.sendQueued(true);

  private sendOnUnload(body: string): void {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(this.url, blob)
      ) {
        return;
      }
    } catch {
      /* fall through to keepalive fetch */
    }
    void this.send(body, false, true);
  }

  /** One attempt, plus at most one retry for network/5xx failures. */
  private async send(
    body: string,
    allowRetry: boolean,
    keepalive = false
  ): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        keepalive,
        body,
      });
      if (response.ok || response.status < 500) return;
    } catch {
      /* retry once below */
    }
    if (!allowRetry) return;
    await new Promise(resolve => setTimeout(resolve, TELEMETRY_RETRY_DELAY_MS));
    try {
      if (this.canSend()) await this.send(body, false);
    } catch {
      /* dropped */
    }
  }

  private canSend(): boolean {
    return this.enabled && !this.privacySignal();
  }

  private privacySignal(): boolean {
    try {
      const nav = navigator as Navigator & {
        globalPrivacyControl?: boolean;
        msDoNotTrack?: string;
      };
      const win = window as Window & { doNotTrack?: string };
      const dnt = [nav.doNotTrack, win.doNotTrack, nav.msDoNotTrack];
      return (
        nav.globalPrivacyControl === true ||
        dnt.some(value => value === '1' || value === 'yes')
      );
    } catch {
      return false;
    }
  }

  private sanitize(input: Record<string, unknown>): TelemetryProperties {
    const out: TelemetryProperties = {};
    for (const key of PROPERTY_KEYS) {
      const value = input[key];
      if (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_PROPERTY_LENGTH &&
        SAFE_PROPERTY_VALUE.test(value) &&
        !LONG_HEX.test(value)
      ) {
        out[key] = value;
      }
    }
    return out;
  }

  private anonymousId(): string {
    const now = Date.now();
    try {
      const raw = window.localStorage.getItem(TELEMETRY_ANON_ID_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as { id?: string; createdAt?: number };
        if (
          typeof stored.id === 'string' &&
          typeof stored.createdAt === 'number' &&
          now - stored.createdAt < TELEMETRY_ANON_ID_ROTATION_MS
        ) {
          return stored.id;
        }
      }
      const fresh = { id: this.uuid(), createdAt: now };
      window.localStorage.setItem(TELEMETRY_ANON_ID_KEY, JSON.stringify(fresh));
      return fresh.id;
    } catch {
      const current = this.fallbackAnonymousId;
      if (current && now - current.createdAt < TELEMETRY_ANON_ID_ROTATION_MS) {
        return current.id;
      }
      return (this.fallbackAnonymousId = { id: this.uuid(), createdAt: now })
        .id;
    }
  }

  private uuid(): string {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(
      ''
    );
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  private clearTimer(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
  }
}
