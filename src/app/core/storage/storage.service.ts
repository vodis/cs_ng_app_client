import { Injectable } from '@angular/core';

type StorageScope = 'local' | 'session';

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  get<T>(key: string, scope: StorageScope = 'local'): T | null {
    const storage = this.resolveStorage(scope);
    const raw = storage.getItem(key);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  set<T>(key: string, value: T, scope: StorageScope = 'local'): void {
    const storage = this.resolveStorage(scope);
    storage.setItem(key, JSON.stringify(value));
  }

  remove(key: string, scope: StorageScope = 'local'): void {
    const storage = this.resolveStorage(scope);
    storage.removeItem(key);
  }

  private resolveStorage(scope: StorageScope): Storage {
    return scope === 'session' ? window.sessionStorage : window.localStorage;
  }
}
