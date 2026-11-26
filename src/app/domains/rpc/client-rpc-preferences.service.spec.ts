import { TestBed } from '@angular/core/testing';
import { StorageService } from '@core/storage/storage.service';
import { ClientRpcPreferencesService } from './client-rpc-preferences.service';

describe('ClientRpcPreferencesService', () => {
  let service: ClientRpcPreferencesService;
  let storage: jasmine.SpyObj<StorageService>;

  beforeEach(() => {
    storage = jasmine.createSpyObj<StorageService>('StorageService', [
      'get',
      'set',
      'remove',
    ]);
    storage.get.and.returnValue(null);

    TestBed.configureTestingModule({
      providers: [
        ClientRpcPreferencesService,
        { provide: StorageService, useValue: storage },
      ],
    });
    service = TestBed.inject(ClientRpcPreferencesService);
  });

  it('resolves the network default when unset', () => {
    const resolved = service.resolvePreferredUrl('eip155:1');
    expect(resolved.source).toBe('default');
    expect(resolved.label).toBe('Default');
    expect(resolved.url).toContain('http');
  });

  it('persists a custom URL under the versioned key', () => {
    service.setChoice('eip155:1', {
      mode: 'custom',
      customUrl: 'https://example-rpc.test',
    });

    expect(storage.set).toHaveBeenCalledWith(
      'app:v1:client-rpc-preferences',
      jasmine.objectContaining({
        version: 1,
        networks: jasmine.objectContaining({
          'eip155:1': {
            mode: 'custom',
            customUrl: 'https://example-rpc.test',
          },
        }),
      })
    );

    const resolved = service.resolvePreferredUrl('eip155:1');
    expect(resolved.source).toBe('custom');
    expect(resolved.url).toBe('https://example-rpc.test');
    expect(resolved.savedCustomUrl).toBe('https://example-rpc.test');
  });

  it('resolves a preset and resets back to default', () => {
    service.setChoice('eip155:8453', {
      mode: 'preset',
      presetId: 'base-publicnode',
    });
    expect(service.resolvePreferredUrl('eip155:8453').source).toBe('preset');
    expect(service.resolvePreferredUrl('eip155:8453').url).toContain('base');

    service.reset('eip155:8453');
    expect(service.choiceFor('eip155:8453').mode).toBe('default');
    expect(service.resolvePreferredUrl('eip155:8453').source).toBe('default');
  });
});
