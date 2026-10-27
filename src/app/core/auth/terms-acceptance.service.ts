import { Injectable } from '@angular/core';
import {
  CURRENT_TERMS_VERSION,
  TERMS_ACCEPTANCE_STORAGE_KEY,
  TermsAcceptanceRecord,
  TermsAcceptanceStore,
} from './terms-acceptance.constants';

@Injectable({ providedIn: 'root' })
export class TermsAcceptanceService {
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
    const store = this.readStore();
    store[userId] = {
      version: CURRENT_TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
    };
    this.writeStore(store);
  }

  private readRecord(userId: string): TermsAcceptanceRecord | null {
    if (!userId) {
      return null;
    }
    return this.readStore()[userId] ?? null;
  }

  private readStore(): TermsAcceptanceStore {
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

  private writeStore(store: TermsAcceptanceStore): void {
    try {
      window.localStorage.setItem(
        TERMS_ACCEPTANCE_STORAGE_KEY,
        JSON.stringify(store)
      );
    } catch {
      // Prototype storage may be blocked; acceptance will be re-prompted.
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
