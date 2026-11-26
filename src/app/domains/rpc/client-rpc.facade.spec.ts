import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import { ClientRpcFacade } from './client-rpc.facade';
import { ClientRpcPreferencesService } from './client-rpc-preferences.service';
import { ClientRpcProbeService } from './client-rpc-probe.service';
import type {
  ClientRpcPreferencesV1,
  RpcEndpointChoice,
  RpcNetworkId,
  RpcProbeResult,
} from './client-rpc.models';
import { findRpcNetwork } from './client-rpc.presets';

describe('ClientRpcFacade polling', () => {
  let facade: ClientRpcFacade;
  let walletState: BehaviorSubject<{ network?: string }>;
  let probe: jasmine.Spy<
    (networkId: string, url: string) => Promise<RpcProbeResult>
  >;
  let preferences: {
    preferences$: BehaviorSubject<ClientRpcPreferencesV1>;
    resolvePreferredUrl: (networkId: RpcNetworkId) => {
      url: string;
      label: string;
      source: 'default' | 'preset' | 'custom';
      savedCustomUrl?: string;
    };
    choiceFor: (networkId: RpcNetworkId) => RpcEndpointChoice;
    setChoice: jasmine.Spy;
    reset: jasmine.Spy;
  };
  let choices: Partial<Record<RpcNetworkId, RpcEndpointChoice>>;

  beforeEach(() => {
    walletState = new BehaviorSubject<{ network?: string }>({
      network: 'eip155:1',
    });
    choices = {};
    const preferencesSubject = new BehaviorSubject<ClientRpcPreferencesV1>({
      version: 1,
      networks: {},
    });

    preferences = {
      preferences$: preferencesSubject,
      resolvePreferredUrl: (networkId: RpcNetworkId) => {
        const network = findRpcNetwork(networkId);
        const choice = choices[networkId] ?? { mode: 'default' as const };
        if (choice.mode === 'custom' && choice.customUrl?.trim()) {
          return {
            url: choice.customUrl.trim(),
            label: 'Custom RPC',
            source: 'custom' as const,
            savedCustomUrl: choice.customUrl.trim(),
          };
        }
        return {
          url: network?.defaultUrl ?? `https://${networkId}.example`,
          label: 'Default',
          source: 'default' as const,
        };
      },
      choiceFor: (networkId: RpcNetworkId) =>
        choices[networkId] ?? { mode: 'default' },
      setChoice: jasmine
        .createSpy('setChoice')
        .and.callFake((networkId: RpcNetworkId, choice: RpcEndpointChoice) => {
          choices[networkId] = choice;
          preferencesSubject.next({
            version: 1,
            networks: { ...choices },
          });
        }),
      reset: jasmine.createSpy('reset').and.callFake((networkId: RpcNetworkId) => {
        delete choices[networkId];
        preferencesSubject.next({
          version: 1,
          networks: { ...choices },
        });
      }),
    };

    probe = jasmine
      .createSpy('probe')
      .and.callFake(async (networkId: string, url: string) => ({
        networkId: networkId as RpcProbeResult['networkId'],
        url,
        ok: true,
        latencyMs: 40,
        level: 'healthy' as const,
        checkedAt: Date.now(),
      }));

    TestBed.configureTestingModule({
      providers: [
        ClientRpcFacade,
        {
          provide: ActiveWalletFacade,
          useValue: { state$: walletState.asObservable() },
        },
        {
          provide: ClientRpcProbeService,
          useValue: { probe },
        },
        {
          provide: ClientRpcPreferencesService,
          useValue: preferences,
        },
      ],
    });

    facade = TestBed.inject(ClientRpcFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function settle(): Promise<void> {
    for (let i = 0; i < 8; i += 1) {
      await Promise.resolve();
    }
  }

  function probedNetworks(): string[] {
    return probe.calls.allArgs().map(([networkId]) => networkId);
  }

  function probedUrls(): string[] {
    return probe.calls.allArgs().map(([, url]) => url);
  }

  it('probes the selected settings network, then returns interval/status to the active wallet', async () => {
    await settle();
    probe.calls.reset();

    facade.openSettings();
    await settle();
    facade.selectNetwork('eip155:8453');
    await settle();
    expect(probedNetworks()).toContain('eip155:8453');

    const selected = await firstValueFrom(facade.selectedNetwork$);
    expect(selected).toBe('eip155:8453');
    expect((await firstValueFrom(facade.status$)).networkId).toBe('eip155:1');
    expect((await firstValueFrom(facade.selectedStatus$)).networkId).toBe(
      'eip155:8453'
    );

    facade.closeSettings();
    await settle();
    expect(probedNetworks().at(-1)).toBe('eip155:1');
    expect(await firstValueFrom(facade.selectedNetwork$)).toBe('eip155:1');
    expect(facade.statusSnapshot().networkId).toBe('eip155:1');
  });

  it('updates selectedStatus when testing the settings network', async () => {
    await settle();
    facade.openSettings();
    facade.selectNetwork('eip155:8453');
    await settle();

    probe.and.callFake(async (networkId: string, url: string) => ({
      networkId: networkId as RpcProbeResult['networkId'],
      url,
      ok: true,
      latencyMs: 120,
      level: 'healthy' as const,
      checkedAt: Date.now(),
    }));

    await facade.testSelected();
    await settle();

    const selected = await firstValueFrom(facade.selectedStatus$);
    expect(selected.networkId).toBe('eip155:8453');
    expect(selected.latencyMs).toBe(120);
    expect((await firstValueFrom(facade.status$)).networkId).toBe('eip155:1');
  });

  it('ignores a superseded failing probe after a new custom URL is saved', async () => {
    await settle();
    probe.calls.reset();

    let releaseOld: ((result: RpcProbeResult) => void) | null = null;
    const oldUrl = 'https://old-bad.example';
    const newUrl = 'https://new-good.example';

    probe.and.callFake(async (networkId: string, url: string) => {
      if (url === oldUrl) {
        return new Promise<RpcProbeResult>(resolve => {
          releaseOld = resolve;
        });
      }
      return {
        networkId: networkId as RpcProbeResult['networkId'],
        url,
        ok: true,
        latencyMs: 55,
        level: 'healthy' as const,
        checkedAt: Date.now(),
      };
    });

    void facade.useCustom('eip155:1', oldUrl);
    await settle();
    expect(releaseOld).not.toBeNull();

    await facade.useCustom('eip155:1', newUrl);
    await settle();

    releaseOld!({
      networkId: 'eip155:1',
      url: oldUrl,
      ok: false,
      latencyMs: 900,
      level: 'failing',
      checkedAt: Date.now(),
      error: 'old endpoint down',
    });
    await settle();

    expect(probedUrls()).toContain(newUrl);
    const status = await firstValueFrom(facade.status$);
    expect(status.endpoint.url).toBe(newUrl);
    expect(status.endpoint.usingFallback).toBeFalse();
    expect(status.level).toBe('healthy');
    expect(status.latencyMs).toBe(55);
  });
});
