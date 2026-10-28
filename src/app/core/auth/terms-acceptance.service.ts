import { Injectable } from '@angular/core';
import {
  CURRENT_TERMS_VERSION,
  TERMS_ACCEPTANCE_STORAGE_KEY,
  TermsAcceptanceRecord,
  TermsAcceptanceStore,
} from './terms-acceptance.constants';

@Injectable({ providedIn: 'root' })
export class TermsAcceptanceService {
  /**
   * Session-scoped fallback when localStorage is blocked or quota-exceeded.
   * Always updated on accept so AuthGuard does not bounce the user back to
   * `/terms` after a failed persistence write.
   */
  private readonly memoryStore: TermsAcceptanceStore = {};

  hasAcceptedCurrent(userId: string): boolean {
    const record = this.readRecord(userId);
    return record?.version === CURRENT_TERMS_VERSION;
  }

  /**
   * True when the user previously accepted any Terms version (including an
   * older one). Used to choose “have changed” vs first-acceptance titles.
   */
  hasPriorAcceptance(userId: string): boolean {
    return this.readRecord(userId) !== null;
  }

  isVersionUpdate(userId: string): boolean {
    return this.hasPriorAcceptance(userId) && !this.hasAcceptedCurrent(userId);
  }

  getAcceptedVersion(userId: string): string | null {
    return this.readRecord(userId)?.version ?? null;
  }

  acceptCurrent(userId: string): void {
    const record: TermsAcceptanceRecord = {
      version: CURRENT_TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    this.memoryStore[userId] = record;

    const store = this.readPersistedStore();
    store[userId] = record;
    this.writePersistedStore(store);
  }

  private readRecord(userId: string): TermsAcceptanceRecord | null {
    if (!userId) {
      return null;
    }
    return (
      this.memoryStore[userId] ?? this.readPersistedStore()[userId] ?? null
    );
  }

  private readPersistedStore(): TermsAcceptanceStore {
    try {
      const raw = window.localStorage.getItem(TERMS_ACCEPTANCE_STORAGE_KEY);
      if (!raw) {
        return {};
      }
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {};
      }
      const store: TermsAcceptanceStore = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (!isAcceptanceRecord(value)) {
          continue;
        }
        store[key] = value;
      }
      return store;
    } catch {
      return {};
    }
  }

  private writePersistedStore(store: TermsAcceptanceStore): void {
    try {
      window.localStorage.setItem(
        TERMS_ACCEPTANCE_STORAGE_KEY,
        JSON.stringify(store)
      );
    } catch {
      // Persistence may be blocked; memoryStore keeps acceptance for this tab.
    }
  }
}

function isAcceptanceRecord(value: unknown): value is TermsAcceptanceRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Partial<TermsAcceptanceRecord>;
  return (
    typeof record.version === 'string' &&
    record.version.length > 0 &&
    typeof record.acceptedAt === 'string' &&
    record.acceptedAt.length > 0
  );
}
