import { AsyncPipe, NgClass } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { rpcHealthLabel } from '@domains/rpc/client-rpc-probe.service';
import { ClientRpcFacade } from '@domains/rpc/client-rpc.facade';

@Component({
  selector: 'app-rpc-status-dot',
  standalone: true,
  imports: [AsyncPipe, NgClass],
  templateUrl: './rpc-status-dot.component.html',
  styleUrls: ['./rpc-status-dot.component.scss'],
})
export class RpcStatusDotComponent {
  @Output() readonly openSettings = new EventEmitter<void>();

  public readonly status$ = this.rpc.status$;

  constructor(private readonly rpc: ClientRpcFacade) {}

  public healthLabel = rpcHealthLabel;

  public onActivate(): void {
    this.openSettings.emit();
    this.rpc.openSettings();
  }
}
