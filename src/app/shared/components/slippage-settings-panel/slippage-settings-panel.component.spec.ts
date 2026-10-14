/// <reference types="jasmine" />

import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { SlippageSettingsPanelComponent } from './slippage-settings-panel.component';

describe('SlippageSettingsPanelComponent', () => {
  let fixture: ComponentFixture<SlippageSettingsPanelComponent>;
  let component: SlippageSettingsPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatIconModule, A11yModule, OverlayModule],
      declarations: [SlippageSettingsPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SlippageSettingsPanelComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    component.slippageToleranceBps = 50;
    component.receiveAtLeastLabel = '1.99 NEAR';
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('selects the matching preset for the saved slippage', () => {
    const active = document.querySelector(
      '.swap-settings-sheet__preset--active'
    ) as HTMLElement;
    expect(active.textContent?.trim()).toBe('0.5%');
  });

  it('emits the chosen preset on save', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);

    const buttons = document.querySelectorAll(
      '.swap-settings-sheet__preset'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[3].click();
    fixture.detectChanges();

    const save = document.querySelector(
      '.swap-settings-sheet__done'
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

    const crossChain = document.querySelector(
      '[aria-label="Swap route"] [role="radio"]:nth-child(2)'
    );
    const confidential = document.querySelector(
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

    const save = document.querySelector(
      '.swap-settings-sheet__done'
    ) as HTMLButtonElement;
    save.click();

    expect(saveSpy).toHaveBeenCalledOnceWith({
      slippageToleranceBps: 50,
      route: 'cross-chain',
      privacy: 'confidential',
    });
  });

  it('accepts a custom percent and disables invalid save', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);

    const input = document.querySelector(
      'input[name="customSlippage"]'
    ) as HTMLInputElement;
    input.value = '0.75';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const save = document.querySelector(
      '.swap-settings-sheet__done'
    ) as HTMLButtonElement;
    expect(save.disabled).toBeFalse();
    save.click();
    expect(saveSpy).toHaveBeenCalledOnceWith({
      slippageToleranceBps: 75,
      route: 'direct',
      privacy: 'public',
    });

    input.value = '99';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBeTrue();
  });

  it('moves focus into the dialog when opened', fakeAsync(() => {
    component.isOpen = false;
    fixture.detectChanges();

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Edit slippage';
    document.body.appendChild(trigger);
    trigger.focus();

    component.isOpen = true;
    fixture.detectChanges();
    tick();

    const close = document.querySelector(
      '.swap-settings-sheet__close'
    ) as HTMLButtonElement;
    expect(document.activeElement).toBe(close);

    trigger.remove();
  }));

  it('emits close on Escape', () => {
    const closeSpy = jasmine.createSpy('close');
    component.closeRequested.subscribe(closeSpy);

    component.handleEscape();

    expect(closeSpy).toHaveBeenCalledTimes(1);
  });
  it('explains an above-policy custom limit without emitting an invalid draft', () => {
    component.maxSlippageBps = 1000;
    const emit = spyOn(component.draftBpsChanged, 'emit');
    const input = document.createElement('input');
    input.value = '11';
    input.addEventListener('input', event => component.onCustomInput(event));
    input.dispatchEvent(new Event('input'));
    expect(component.validationError).toContain('10%');
    expect(component.canSave()).toBeFalse();
    expect(emit).not.toHaveBeenCalled();
  });
});
