/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SideModalComponent } from './side-modal.component';

describe('SideModalComponent', () => {
  let fixture: ComponentFixture<SideModalComponent>;
  let component: SideModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SideModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SideModalComponent);
    component = fixture.componentInstance;
    component.isOpen = true;
    fixture.detectChanges();
  });

  function panel(): HTMLElement {
    return fixture.nativeElement.querySelector('.side-modal') as HTMLElement;
  }

  function backdrop(): HTMLElement {
    return fixture.nativeElement.querySelector(
      '.side-modal-backdrop'
    ) as HTMLElement;
  }

  it('keeps the panel scrollable when projected content exceeds the viewport', () => {
    expect(getComputedStyle(panel()).overflowY).toBe('auto');
  });

  it('stacks above the mobile floating nav', () => {
    expect(
      Number.parseInt(getComputedStyle(backdrop()).zIndex, 10)
    ).toBeGreaterThan(110);
    expect(
      Number.parseInt(getComputedStyle(panel()).zIndex, 10)
    ).toBeGreaterThan(110);
  });

  it('slides the panel with a transform transition', () => {
    component.isOpen = false;
    fixture.detectChanges();

    expect(getComputedStyle(panel()).transition).toContain('transform');

    component.isOpen = true;
    fixture.detectChanges();

    expect(getComputedStyle(panel()).transition).toContain('transform');
  });

  it('releases pointer events and is inert when closed', () => {
    component.isOpen = false;
    fixture.detectChanges();

    const dialog = panel();
    expect(getComputedStyle(dialog).pointerEvents).toBe('none');
    expect(getComputedStyle(dialog).visibility).toBe('hidden');
    expect(dialog.inert).toBeTrue();
    expect(dialog.getAttribute('aria-hidden')).toBe('true');
  });

  it('does not mark the open panel as inert', () => {
    expect(panel().hasAttribute('inert')).toBeFalse();
    expect(panel().inert).toBeFalse();
  });

  it('emits closeRequested when the open backdrop is clicked', () => {
    const emitSpy = spyOn(component.closeRequested, 'emit');

    backdrop().click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits closeRequested when the wallet close control is clicked', () => {
    const emitSpy = spyOn(component.closeRequested, 'emit');
    const closeButton = document.createElement('button');
    closeButton.className = 'connect-wallet__close';
    closeButton.setAttribute('aria-label', 'Close wallet connection dialog');
    panel().appendChild(closeButton);

    closeButton.click();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });

  it('emits closeRequested on Escape while open', () => {
    const emitSpy = spyOn(component.closeRequested, 'emit');

    component.handleEscape();

    expect(emitSpy).toHaveBeenCalledTimes(1);
  });
});
