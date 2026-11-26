import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { ActiveWalletFacade } from '@domains/wallet/application/active-wallet.facade';
import { ClientRpcFacade } from './client-rpc.facade';
import { ClientRpcPreferencesService } from './client-rpc-preferences.service';
import { ClientRpcProbeService } from './client-rpc-probe.service';
import type { RpcProbeResult } from './client-rpc.models';

describe('ClientRpcFacade polling', () => {
  let facade: ClientRpcFacade;
  let walletState: BehaviorSubject<{ network?: string }>;
  let probe: jasmine.Spy<
    (networkId: string, url: string) => Promise<RpcProbeResult>
  >;

  beforeEach(() => {
    walletState = new BehaviorSubject<{ network?: string }>({
      network: 'eip155:1',
    });
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
          useValue: {
            preferences$: new BehaviorSubject({ version: 1, networks: {} }),
            resolvePreferredUrl: (networkId: string) => ({
              url: `https://${networkId}.example`,
              label: 'Default',
              source: 'default' as const,
            }),
            choiceFor: () => ({ mode: 'default' as const }),
            setChoice: jasmine.createSpy('setChoice'),
            reset: jasmine.createSpy('reset'),
          },
        },
      ],
    });

    facade = TestBed.inject(ClientRpcFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function settle(): Promise<void> {
    // Drain nested refreshNetwork pending queue (probe → finally → pending).
    for (let i = 0; i < 6; i += 1) {
      await Promise.resolve();
    }
  }

  function probedNetworks(): string[] {
    return probe.calls.allArgs().map(([networkId]) => networkId);
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

    facade.closeSettings();
    await settle();
    expect(probedNetworks().at(-1)).toBe('eip155:1');
    expect(await firstValueFrom(facade.selectedNetwork$)).toBe('eip155:1');
    expect(facade.statusSnapshot().networkId).toBe('eip155:1');
  });
});
