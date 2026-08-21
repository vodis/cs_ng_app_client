import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { ProductEventsService } from './product-events.service';

describe('ProductEventsService', () => {
  let service: ProductEventsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });

    service = TestBed.inject(ProductEventsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('records events with an in-memory anonymous id when localStorage is blocked', () => {
    spyOn(window.localStorage, 'getItem').and.throwError('storage blocked');
    spyOn(window.localStorage, 'setItem').and.throwError('storage blocked');

    expect(() =>
      service.record({
        eventName: 'auth.login',
        status: 'attempted',
      })
    ).not.toThrow();

    const firstRequest = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    const firstAnonymousId = firstRequest.request.body.anonymousId;
    expect(firstAnonymousId).toBeTruthy();
    firstRequest.flush({});

    service.record({
      eventName: 'auth.login',
      status: 'succeeded',
    });

    const secondRequest = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    expect(secondRequest.request.body.anonymousId).toBe(firstAnonymousId);
    secondRequest.flush({});
  });

  it('warns when failed auth telemetry delivery is rejected', () => {
    const warn = spyOn(console, 'warn');

    service.record({
      eventName: 'auth.login',
      status: 'failed',
      reasonCode: 'invalid_authenticator_response',
      metadata: { message: 'Invalid authenticator response' },
    });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    request.flush(
      { error: 'bad request' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(warn).toHaveBeenCalledOnceWith(
      `product telemetry delivery failed url=${environment.apiUrl}/api/v1/product-events status=400`
    );
  });

  it('does not warn when routine telemetry delivery is rejected', () => {
    const warn = spyOn(console, 'warn');

    service.record({
      eventName: 'wallet.connect',
      status: 'failed',
      reasonCode: 'provider_error',
    });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    request.flush(
      { error: 'bad request' },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(warn).not.toHaveBeenCalled();
  });

  it('recordFailure normalizes reasonCode and message', () => {
    service.recordFailure(
      'wallet.last_connected.persist',
      new Error('Quota exceeded'),
      {
        metadata: {
          action: 'set',
          storage: 'sessionStorage',
        },
      }
    );

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        eventName: 'wallet.last_connected.persist',
        status: 'failed',
        reasonCode: 'quota_exceeded',
        source: 'app-client',
        metadata: jasmine.objectContaining({
          action: 'set',
          storage: 'sessionStorage',
          message: 'Quota exceeded',
        }),
      })
    );
    request.flush({});
  });

  it('recordFailure uses unknown reason for non-Error values', () => {
    service.recordFailure('wallet.last_connected.persist', 'boom');

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    expect(request.request.body).toEqual(
      jasmine.objectContaining({
        eventName: 'wallet.last_connected.persist',
        status: 'failed',
        reasonCode: 'unknown',
      })
    );
    request.flush({});
  });

  it('recursively removes credential-shaped telemetry fields', () => {
    service.record({
      eventName: 'agent.authorization',
      status: 'failed',
      metadata: {
        decision: 'approve',
        nested: {
          authorizationCode: 'must-not-leak',
          codeVerifier: 'must-not-leak',
          safe: 'kept',
        },
      },
    });

    const request = httpMock.expectOne(
      `${environment.apiUrl}/api/v1/product-events`
    );
    expect(request.request.body.metadata).toEqual({
      decision: 'approve',
      nested: { safe: 'kept' },
    });
    request.flush({});
  });
});
