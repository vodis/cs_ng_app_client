import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { RecipientAddressPanelComponent } from './recipient-address-panel.component';

describe('RecipientAddressPanelComponent', () => {
  let component: RecipientAddressPanelComponent;
  let fixture: ComponentFixture<RecipientAddressPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [RecipientAddressPanelComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(RecipientAddressPanelComponent);
    component = fixture.componentInstance;
    component.blockchain = 'sol';
  });

  it('blocks an invalid address and emits a valid trimmed address', () => {
    const emitSpy = spyOn(component.addressSaved, 'emit');
    component.draftAddress = 'invalid';
    component.save();
    expect(component.validationError).toBe('Enter a valid Solana address.');
    expect(emitSpy).not.toHaveBeenCalled();

    component.draftAddress = ' BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z ';
    component.save();
    expect(emitSpy).toHaveBeenCalledWith(
      'BYPsjxa3YuZESQz1dKuBw1QSFCSpecsm8nCQhY5xbU1Z'
    );
  });

  it('renders the coming-soon recipient options', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Scan QR code');
    expect(fixture.nativeElement.textContent).toContain(
      'Connect recipient wallet'
    );
    expect(fixture.nativeElement.textContent).toContain('COMING SOON');
  });
});
