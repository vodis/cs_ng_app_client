import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LayoutComponent } from './layout.component';

type LayoutComponentTestHarness = LayoutComponent & {
  updateShellVisibility(url: string): void;
};

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [LayoutComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('hides shell on auth routes before router navigation settles', () => {
    const layout = component as LayoutComponentTestHarness;

    layout.updateShellVisibility('/login');
    expect(component.hideShell).toBeTrue();
    expect(
      document.documentElement.classList.contains('auth-shell-route')
    ).toBeTrue();

    layout.updateShellVisibility('/');
    expect(component.hideShell).toBeFalse();
    expect(
      document.documentElement.classList.contains('auth-shell-route')
    ).toBeFalse();
  });
});
