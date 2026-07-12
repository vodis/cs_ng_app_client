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
});
