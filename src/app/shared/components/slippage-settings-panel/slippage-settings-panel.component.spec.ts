/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatIconModule } from '@angular/material/icon';
import { SlippageSettingsPanelComponent } from './slippage-settings-panel.component';

describe('SlippageSettingsPanelComponent', () => {
  let fixture: ComponentFixture<SlippageSettingsPanelComponent>;
  let component: SlippageSettingsPanelComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatIconModule],
      declarations: [SlippageSettingsPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SlippageSettingsPanelComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    component.slippageToleranceBps = 50;
    component.receiveAtLeastLabel = '1.99 NEAR';
    fixture.detectChanges();
  });

  it('selects the matching preset for the saved slippage', () => {
    const active = fixture.nativeElement.querySelector(
      '.slippage-settings__preset--active'
    ) as HTMLElement;
    expect(active.textContent?.trim()).toBe('0.5%');
  });

  it('emits the chosen preset on save', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);

    const buttons = fixture.nativeElement.querySelectorAll(
      '.slippage-settings__preset'
    ) as NodeListOf<HTMLButtonElement>;
    buttons[3].click();
    fixture.detectChanges();

    const save = fixture.nativeElement.querySelector(
      '.slippage-settings__button--save'
    ) as HTMLButtonElement;
    save.click();

    expect(saveSpy).toHaveBeenCalledOnceWith(100);
  });

  it('accepts a custom percent and disables invalid save', () => {
    const saveSpy = jasmine.createSpy('save');
    component.saveRequested.subscribe(saveSpy);

    const input = fixture.nativeElement.querySelector(
      'input[name="customSlippage"]'
    ) as HTMLInputElement;
    input.value = '0.75';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const save = fixture.nativeElement.querySelector(
      '.slippage-settings__button--save'
    ) as HTMLButtonElement;
    expect(save.disabled).toBeFalse();
    save.click();
    expect(saveSpy).toHaveBeenCalledOnceWith(75);

    input.value = '99';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(save.disabled).toBeTrue();
  });
});
