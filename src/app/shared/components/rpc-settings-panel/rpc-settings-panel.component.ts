import { AsyncPipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CsCloseButtonComponent } from '@vodis/cs-ui/angular';
import { combineLatest, map } from 'rxjs';
import { ClientRpcFacade } from '@domains/rpc/client-rpc.facade';
import type { RpcNetworkId } from '@domains/rpc/client-rpc.models';
import { findRpcNetwork } from '@domains/rpc/client-rpc.presets';
import { rpcHealthLabel } from '@domains/rpc/client-rpc-probe.service';

@Component({
  selector: 'app-rpc-settings-panel',
  standalone: true,
  imports: [AsyncPipe, FormsModule, CsCloseButtonComponent],
  templateUrl: './rpc-settings-panel.component.html',
  styleUrls: ['./rpc-settings-panel.component.scss'],
})
export class RpcSettingsPanelComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly rpc = inject(ClientRpcFacade);

  public readonly networks = this.rpc.networks;
  public readonly healthLabel = rpcHealthLabel;
  public customUrl = '';

  public readonly view$ = combineLatest([
    this.rpc.selectedNetwork$,
    this.rpc.status$,
    this.rpc.testing$,
    this.rpc.testMessage$,
    this.rpc.settingsOpen$,
  ]).pipe(
    map(([networkId, status, testing, testMessage]) => {
      const definition = findRpcNetwork(networkId);
      const choice = this.rpc.choiceFor(networkId);
      const endpoint = this.rpc.endpointFor(networkId);
      return {
        networkId,
        definition,
        choice,
        endpoint,
        status,
        testing,
        testMessage,
      };
    })
  );

  constructor() {
    this.rpc.selectedNetwork$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(networkId => {
        const choice = this.rpc.choiceFor(networkId);
        this.customUrl = choice.customUrl ?? '';
      });
  }

  public close(): void {
    this.rpc.closeSettings();
  }

  public selectNetwork(networkId: string): void {
    this.rpc.selectNetwork(networkId as RpcNetworkId);
  }

  public useDefault(networkId: RpcNetworkId): void {
    void this.rpc.useDefault(networkId);
  }

  public usePreset(networkId: RpcNetworkId, presetId: string): void {
    void this.rpc.usePreset(networkId, presetId);
  }

  public saveCustom(networkId: RpcNetworkId): void {
    void this.rpc.useCustom(networkId, this.customUrl);
  }

  public test(): void {
    void this.rpc.testSelected();
  }
}
