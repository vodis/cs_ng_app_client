import { Injectable, OnDestroy } from '@angular/core';
import { resolvePrivyHostBridge } from './privy-host-bridge';
import type { CraftscriptPrivyBridge } from './privy-bridge.types';
import './privy-bridge.types';

@Injectable({ providedIn: 'root' })
export class PrivyBridgeService implements OnDestroy {
  private assignedBridge: CraftscriptPrivyBridge | undefined;

  initialize(): void {
    const bridge = resolvePrivyHostBridge();
    if (!bridge || window.craftscriptPrivy === bridge) {
      return;
    }

    window.craftscriptPrivy = bridge;
    this.assignedBridge = bridge;
  }

  ngOnDestroy(): void {
    if (
      this.assignedBridge &&
      window.craftscriptPrivy === this.assignedBridge
    ) {
      delete window.craftscriptPrivy;
    }

    this.assignedBridge = undefined;
  }
}
