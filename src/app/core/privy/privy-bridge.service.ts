import { Injectable, OnDestroy } from '@angular/core';
import type { Root } from 'react-dom/client';
import { environment } from '../../../environments/environment';
import { mountPrivyHostBridge } from './privy-host-bridge.react';
import './privy-bridge.types';

@Injectable({ providedIn: 'root' })
export class PrivyBridgeService implements OnDestroy {
  private root: Root | undefined;
  private hostElement: HTMLElement | undefined;

  initialize(): void {
    if (this.root || !environment.privyAppId) {
      return;
    }

    this.hostElement = document.createElement('div');
    this.hostElement.setAttribute('data-craftscript-privy-bridge', 'true');
    this.hostElement.style.display = 'none';
    document.body.appendChild(this.hostElement);

    this.root = mountPrivyHostBridge(this.hostElement, {
      appId: environment.privyAppId,
      clientId: environment.privyClientId,
    });
  }

  ngOnDestroy(): void {
    this.root?.unmount();
    this.root = undefined;
    this.hostElement?.remove();
    this.hostElement = undefined;
    if (window.craftscriptPrivy) {
      delete window.craftscriptPrivy;
    }
  }
}
