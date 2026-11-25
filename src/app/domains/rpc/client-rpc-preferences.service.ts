import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { StorageService } from '@core/storage/storage.service';
import type {
  ClientRpcPreferencesV1,
  RpcEndpointChoice,
  RpcNetworkId,
} from './client-rpc.models';
import { CLIENT_RPC_NETWORKS, findRpcNetwork } from './client-rpc.presets';

const STORAGE_KEY = 'app:v1:client-rpc-preferences';

const EMPTY: ClientRpcPreferencesV1 = {
  version: 1,
  networks: {},
};

@Injectable({ providedIn: 'root' })
export class ClientRpcPreferencesService {
  private readonly preferencesSubject =
    new BehaviorSubject<ClientRpcPreferencesV1>(this.read());

  public readonly preferences$ = this.preferencesSubject.asObservable();

  constructor(private readonly storage: StorageService) {}

  public snapshot(): ClientRpcPreferencesV1 {
    return this.preferencesSubject.value;
  }

  public choiceFor(networkId: RpcNetworkId): RpcEndpointChoice {
    return (
      this.preferencesSubject.value.networks[networkId] ?? {
        mode: 'default',
      }
    );
  }

  public setChoice(networkId: RpcNetworkId, choice: RpcEndpointChoice): void {
    const next: ClientRpcPreferencesV1 = {
      version: 1,
      networks: {
        ...this.preferencesSubject.value.networks,
        [networkId]: choice,
      },
    };
    this.persist(next);
  }

  public reset(networkId: RpcNetworkId): void {
    const networks = { ...this.preferencesSubject.value.networks };
    delete networks[networkId];
    this.persist({ version: 1, networks });
  }

  public resolvePreferredUrl(networkId: RpcNetworkId): {
    url: string;
    label: string;
    source: 'default' | 'preset' | 'custom';
    savedCustomUrl?: string;
  } {
    const network = findRpcNetwork(networkId);
    if (!network) {
      return {
        url: '',
        label: 'Unknown',
        source: 'default',
      };
    }
    const choice = this.choiceFor(networkId);
    if (choice.mode === 'custom' && choice.customUrl?.trim()) {
      return {
        url: choice.customUrl.trim(),
        label: 'Custom RPC',
        source: 'custom',
        savedCustomUrl: choice.customUrl.trim(),
      };
    }
    if (choice.mode === 'preset' && choice.presetId) {
      const preset = network.presets.find(item => item.id === choice.presetId);
      if (preset) {
        return {
          url: preset.url,
          label: preset.label,
          source: 'preset',
          savedCustomUrl: choice.customUrl?.trim() || undefined,
        };
      }
    }
    return {
      url: network.defaultUrl,
      label: 'Default',
      source: 'default',
      savedCustomUrl: choice.customUrl?.trim() || undefined,
    };
  }

  public supportedNetworkIds(): RpcNetworkId[] {
    return CLIENT_RPC_NETWORKS.map(network => network.id);
  }

  private read(): ClientRpcPreferencesV1 {
    try {
      const stored = this.storage.get<ClientRpcPreferencesV1>(STORAGE_KEY);
      if (!stored || stored.version !== 1 || !stored.networks) {
        return EMPTY;
      }
      return {
        version: 1,
        networks: { ...stored.networks },
      };
    } catch {
      return EMPTY;
    }
  }

  private persist(value: ClientRpcPreferencesV1): void {
    this.preferencesSubject.next(value);
    try {
      this.storage.set(STORAGE_KEY, value);
    } catch {
      // Private mode / quota — keep in-memory preference only.
    }
  }
}
