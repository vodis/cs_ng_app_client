import { Injectable } from '@angular/core';
import { StorageService } from '@core/storage/storage.service';
import {
  ChartMode,
  ChartSettings,
  DEFAULT_CHART_SETTINGS,
} from '@shared/models/chart.models';

@Injectable({
  providedIn: 'root',
})
export class ChartSettingsService {
  private readonly storageKey = 'craftscript:chart-settings';
  private settings: ChartSettings;

  constructor(private readonly storage: StorageService) {
    this.settings = {
      ...DEFAULT_CHART_SETTINGS,
      ...this.storage.get<ChartSettings>(this.storageKey),
    };
  }

  public snapshot(): ChartSettings {
    return { ...this.settings };
  }

  public get mode(): ChartMode {
    return this.settings.mode;
  }

  public get windowSecs(): number {
    return this.settings.windowSecs;
  }

  public setMode(mode: ChartMode): void {
    if (this.settings.mode === mode) {
      return;
    }

    this.settings = { ...this.settings, mode };
    this.persist();
  }

  public setWindowSecs(windowSecs: number): void {
    if (this.settings.windowSecs === windowSecs) {
      return;
    }

    this.settings = { ...this.settings, windowSecs };
    this.persist();
  }

  private persist(): void {
    this.storage.set(this.storageKey, this.settings);
  }
}
