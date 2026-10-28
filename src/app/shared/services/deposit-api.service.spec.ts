import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AuthProviderService } from '@core/auth/auth-provider.service';
import { DepositApiService } from './deposit-api.service';

describe('DepositApiService', () => {
  let api: DepositApiService;
  let http: HttpTestingController;
  const data = {
    amount: '1',
    minimumReceived: '0.9',
    walletId: 'wallet',
    recipient: 'receiver',
    assetId: 'asset',
    network: 'eip155:8453',
    address: 'deposit-address',
    expiresAt: '2099-01-01T00:00:00Z',
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthProviderService,
          useValue: { getAccessToken: async () => 'test-token' },
        },
      ],
    });
    api = TestBed.inject(DepositApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends amount, asset and wallet IDs using authenticated backend transport', fakeAsync(() => {
    let address = '';
    void api
      .create('wallet', 'asset', 'eip155:8453', 'receiver', '1')
      .then(result => (address = result.address));
    tick();
    const request = http.expectOne(req =>
      req.url.endsWith('/api/v1/deposits/instructions')
    );
    expect(request.request.body).toEqual({
      amount: '1',
      walletId: 'wallet',
      assetId: 'asset',
    });
    expect(request.request.headers.get('Authorization')).toBe(
      'Bearer test-token'
    );
    request.flush({ data });
    tick();
    expect(address).toBe('deposit-address');
  }));

  for (const change of [
    { amount: '2' },
    { minimumReceived: '-1' },
    { minimumReceived: '0' },
    { recipient: 'other' },
    { walletId: 'other' },
    { network: 'eip155:1' },
    { assetId: 'other' },
    { expiresAt: '2000-01-01T00:00:00Z' },
    { address: '' },
    { memo: 123 },
  ]) {
    it(`rejects mismatched or malformed instructions: ${JSON.stringify(change)}`, fakeAsync(() => {
      let rejected = false;
      void api
        .create('wallet', 'asset', 'eip155:8453', 'receiver', '1')
        .catch(() => (rejected = true));
      tick();
      http
        .expectOne(req => req.url.endsWith('/api/v1/deposits/instructions'))
        .flush({ data: { ...data, ...change } });
      tick();
      expect(rejected).toBeTrue();
    }));
  }
});
