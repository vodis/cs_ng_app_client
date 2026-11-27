import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  TELEMETRY_ANON_ID_KEY,
  TELEMETRY_ANON_ID_ROTATION_MS,
  TELEMETRY_GATEWAY_ENABLED,
  TelemetryGateway,
} from './telemetry-gateway.service';

const URL = `${environment.apiUrl}/api/v1/product-events/batch`;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('TelemetryGateway', () => {
  let routerEvents: Subject<unknown>;
  let fetchSpy: jasmine.Spy;
  let beaconSpy: jasmine.Spy;

  function create(enabled = true): TelemetryGateway {
    TestBed.configureTestingModule({
      providers: [
        { provide: TELEMETRY_GATEWAY_ENABLED, useValue: enabled },
        { provide: Router, useValue: { events: routerEvents } },
      ],
    });
    return TestBed.inject(TelemetryGateway);
  }

  function bodies(spy: jasmine.Spy): { events: any[] }[] {
    return spy.calls.allArgs().map(args => {
      const body = args[1]?.body ?? args[1];
      return JSON.parse(body as string);
    });
  }

  async function beaconBody(): Promise<{ events: any[] }> {
    const blob = beaconSpy.calls.mostRecent().args[1] as Blob;
    return JSON.parse(await blob.text());
  }

  function setPrivacy(name: string, value: unknown) {
    Object.defineProperty(navigator, name, { value, configurable: true });
  }

  beforeEach(() => {
    routerEvents = new Subject();
    window.localStorage.removeItem(TELEMETRY_ANON_ID_KEY);
    fetchSpy = spyOn(window, 'fetch').and.resolveTo(new Response(null));
    beaconSpy = jasmine.createSpy('sendBeacon').and.returnValue(true);
    setPrivacy('sendBeacon', beaconSpy);
  });

  afterEach(() => {
    for (const name of ['globalPrivacyControl', 'doNotTrack', 'sendBeacon']) {
      delete (navigator as any)[name];
    }
    window.localStorage.removeItem(TELEMETRY_ANON_ID_KEY);
  });

  it('queues and sends nothing when the flag is off', fakeAsync(() => {
    const gateway = create(false);
    gateway.init();
    for (let i = 0; i < 30; i++) gateway.track('swap.quote', 'success');
    routerEvents.next(new NavigationEnd(1, '/a', '/a'));
    tick(10_000);
    gateway.flush();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('pagehide'));

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(TELEMETRY_ANON_ID_KEY)).toBeNull();
  }));

  it('flushes after 5 seconds', fakeAsync(() => {
    const gateway = create();
    gateway.track('auth.login', 'success');
    tick(4_999);
    expect(fetchSpy).not.toHaveBeenCalled();
    tick(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.calls.mostRecent().args[0]).toBe(URL);
    expect(bodies(fetchSpy)[0].events.length).toBe(1);
  }));

  it('flushes once 20 events are queued', fakeAsync(() => {
    const gateway = create();
    for (let i = 0; i < 19; i++) gateway.track('swap.quote', 'success');
    expect(fetchSpy).not.toHaveBeenCalled();
    gateway.track('swap.quote', 'success');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(bodies(fetchSpy)[0].events.length).toBe(20);
  }));

  it('never sends more than 50 events per request', fakeAsync(() => {
    const gateway = create();
    (gateway as any).queue = Array.from({ length: 120 }, () => ({
      event_id: 'x',
      name: 'swap.quote',
      status: 'success',
      occurred_at: '',
      anonymous_id: 'a',
      properties: {},
    }));
    gateway.flush();
    const sizes = bodies(fetchSpy).map(b => b.events.length);
    expect(sizes).toEqual([50, 50, 20]);
  }));

  it('sends queued events with sendBeacon when the page is hidden', async () => {
    const gateway = create();
    gateway.init();
    gateway.track('wallet.connect', 'success', { network: 'near' });
    spyOnProperty(document, 'visibilityState').and.returnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(beaconSpy.calls.mostRecent().args[0]).toBe(URL);
    expect((await beaconBody()).events[0].name).toBe('wallet.connect');
    expect(fetchSpy).not.toHaveBeenCalled();
    gateway.ngOnDestroy();
  });

  it('flushes on pagehide and falls back to keepalive fetch', () => {
    beaconSpy.and.returnValue(false);
    const gateway = create();
    gateway.init();
    gateway.track('wallet.connect', 'success');
    window.dispatchEvent(new Event('pagehide'));

    expect(beaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.calls.mostRecent().args[1].keepalive).toBe(true);
    gateway.ngOnDestroy();
  });

  it('sends nothing with Global Privacy Control', fakeAsync(() => {
    setPrivacy('globalPrivacyControl', true);
    const gateway = create();
    gateway.track('auth.login', 'success');
    tick(10_000);
    gateway.flush();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(beaconSpy).not.toHaveBeenCalled();
  }));

  it('sends nothing with Do-Not-Track', fakeAsync(() => {
    setPrivacy('doNotTrack', '1');
    const gateway = create();
    for (let i = 0; i < 25; i++) gateway.track('auth.login', 'success');
    tick(10_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  }));

  it('records page views with the route template only', fakeAsync(() => {
    const gateway = create();
    gateway.init();
    routerEvents.next(
      new NavigationEnd(1, '/swap/9f2c4a1b8d?x=1', '/swap/9f2c4a1b8d?x=1')
    );
    tick(5_000);
    const [event] = bodies(fetchSpy)[0].events;
    expect(event.name).toBe('page.view');
    expect(event.properties).toEqual({ route: '/swap/[id]' });
    gateway.ngOnDestroy();
  }));

  it('adds a UUIDv4 event_id and a stable anonymous id', fakeAsync(() => {
    const gateway = create();
    gateway.track('auth.login', 'success');
    gateway.track('auth.login', 'failure');
    tick(5_000);
    const [a, b] = bodies(fetchSpy)[0].events;
    expect(a.event_id).toMatch(UUID_V4);
    expect(a.event_id).not.toBe(b.event_id);
    expect(a.anonymous_id).toMatch(UUID_V4);
    expect(a.anonymous_id).toBe(b.anonymous_id);
  }));

  it('rotates the anonymous id after 30 days', fakeAsync(() => {
    const old = {
      id: '11111111-1111-4111-8111-111111111111',
      createdAt: Date.now() - TELEMETRY_ANON_ID_ROTATION_MS - 1,
    };
    window.localStorage.setItem(TELEMETRY_ANON_ID_KEY, JSON.stringify(old));
    const gateway = create();
    gateway.track('auth.login', 'success');
    tick(5_000);
    expect(bodies(fetchSpy)[0].events[0].anonymous_id).not.toBe(old.id);
  }));

  it('keeps the anonymous id when it is recent', fakeAsync(() => {
    const recent = {
      id: '22222222-2222-4222-8222-222222222222',
      createdAt: Date.now() - 1_000,
    };
    window.localStorage.setItem(TELEMETRY_ANON_ID_KEY, JSON.stringify(recent));
    const gateway = create();
    gateway.track('auth.login', 'success');
    tick(5_000);
    expect(bodies(fetchSpy)[0].events[0].anonymous_id).toBe(recent.id);
  }));

  it('never sends personal identifiers in the payload', fakeAsync(() => {
    const gateway = create();
    gateway.track('wallet.connect', 'success', {
      network: 'near',
      wallet_type: 'external',
      email: 'alice@example.com',
      address: '0x52908400098527886E0F7030069857D2E4169EE7',
      amount: '12.5',
      token: 'secret-token',
    });
    gateway.track('deposit.started', 'success', {
      network: 'alice.near',
      wallet_type: 'bob@example.com',
      route: '/profile?email=a@b.c',
      error_category: '0x52908400098527886E0F7030069857D2E4169EE7',
    });
    tick(5_000);
    const events = bodies(fetchSpy)[0].events;
    expect(events[0].properties).toEqual({
      network: 'near',
      wallet_type: 'external',
    });
    expect(events[1].properties).toEqual({});
    const raw = JSON.stringify(events);
    for (const secret of ['alice', 'bob', '@', '0x5290', '12.5', 'secret']) {
      expect(raw).not.toContain(secret);
    }
  }));

  it('retries a failed send at most once and then drops the batch', fakeAsync(() => {
    fetchSpy.and.rejectWith(new TypeError('network down'));
    const gateway = create();
    gateway.track('auth.login', 'success');
    tick(5_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    tick(2_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    tick(60_000);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  }));

  it('does not throw when sending fails synchronously', fakeAsync(() => {
    fetchSpy.and.throwError('boom');
    const gateway = create();
    expect(() => {
      gateway.track('auth.login', 'success');
      tick(5_000);
      tick(2_000);
    }).not.toThrow();
  }));
});
