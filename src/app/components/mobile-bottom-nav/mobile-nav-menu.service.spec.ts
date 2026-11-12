/// <reference types="jasmine" />

import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { MobileNavMenuService } from './mobile-nav-menu.service';

describe('MobileNavMenuService', () => {
  let service: MobileNavMenuService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MobileNavMenuService);
  });

  it('starts closed', () => {
    expect(service.isOpen).toBeFalse();
  });

  it('opens, closes, and toggles', fakeAsync(() => {
    const focusSpy = jasmine.createSpy('focusTrigger');
    const focusSub = service.focusTrigger$.subscribe(focusSpy);

    service.open();
    expect(service.isOpen).toBeTrue();

    service.open();
    expect(service.isOpen).toBeTrue();

    service.close();
    expect(service.isOpen).toBeFalse();
    tick();
    expect(focusSpy).not.toHaveBeenCalled();

    service.toggle();
    expect(service.isOpen).toBeTrue();

    service.toggle();
    expect(service.isOpen).toBeFalse();
    tick();
    expect(focusSpy).toHaveBeenCalledTimes(1);

    focusSub.unsubscribe();
  }));
});
