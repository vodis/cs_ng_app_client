/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CsSwapSettingsComponent } from '@vodis/cs-ui/angular';

describe('CsSwapSettingsComponent host wiring', () => {
  let fixture: ComponentFixture<CsSwapSettingsComponent>;
  let component: CsSwapSettingsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsSwapSettingsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CsSwapSettingsComponent);
    component = fixture.componentInstance;
    component.open = true;
    component.slippageToleranceBps = 50;
    component.receiveAtLeastLabel = '1.99 NEAR';
    component.ngOnChanges({
      open: {
        previousValue: false,
        currentValue: true,
        firstChange: true,
        isFirstChange: () => true,
      },
    });
    fixture.detectChanges();
  });

  it('selects the matching preset for the saved slippage', () => {
    const active = fixture.nativeElement.querySelector(
      '.cs-swap-settings__preset--active'
    ) as HTMLElement;
    expect(active.textContent?.trim()).toBe('0.5%');
  });

  it('emits the chosen preset on save', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);

    const buttons = fixture.nativeElement.querySelectorAll(
      '.cs-swap-settings__preset'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[3].click();
    fixture.detectChanges();

    const save = fixture.nativeElement.querySelector(
      '.cs-swap-settings__done'
    ) as HTMLButtonElement;
    save.click();

    expect(saveSpy).toHaveBeenCalledOnceWith({
      slippageToleranceBps: 100,
      route: 'direct',
      privacy: 'public',
    });
  });

  it('emits the selected route and privacy with the slippage', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);
    component.crossChainRouteEnabled = true;
    fixture.detectChanges();

    const crossChain = fixture.nativeElement.querySelector(
      '[aria-label="Swap route"] [role="radio"]:nth-child(2)'
    );
    const confidential = fixture.nativeElement.querySelector(
      '[aria-label="Swap privacy"] [role="radio"]:nth-child(2)'
    );
    if (
      !(crossChain instanceof HTMLButtonElement) ||
      !(confidential instanceof HTMLButtonElement)
    ) {
      throw new Error('Missing settings choices');
    }
    crossChain.click();
    confidential.click();
    fixture.detectChanges();

    const save = fixture.nativeElement.querySelector(
      '.cs-swap-settings__done'
    ) as HTMLButtonElement;
    save.click();

    expect(saveSpy).toHaveBeenCalledOnceWith({
      slippageToleranceBps: 50,
      route: 'cross-chain',
      privacy: 'confidential',
    });
  });

  it('emits close from the header control', () => {
    const closeSpy = jasmine.createSpy('close');
    component.close.subscribe(closeSpy);
    const close = fixture.nativeElement.querySelector(
      '.cs-swap-settings__close'
    ) as HTMLButtonElement;
    close.click();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
});
