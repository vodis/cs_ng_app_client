import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { TokenSelectPanelComponent } from './token-select-panel.component';

describe('TokenSelectPanelComponent', () => {
  const tokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId: 'usdc-asset',
      color: '#2f8cff',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'near-asset',
      color: '#2fd17c',
    },
  ];

  let component: TokenSelectPanelComponent;
  let fixture: ComponentFixture<TokenSelectPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TokenSelectPanelComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });

    fixture = TestBed.createComponent(TokenSelectPanelComponent);
    component = fixture.componentInstance;
    component.tokens = tokens;
    component.title = 'Select source token';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the panel title', () => {
    const title = fixture.nativeElement.querySelector(
      '.token-select-panel__title'
    );

    expect(title?.textContent?.trim()).toBe('Select source token');
  });

  it('should exclude the provided symbol from available tokens', () => {
    component.excludedSymbol = 'NEAR';
    fixture.detectChanges();

    expect(component.availableTokens).toEqual([tokens[0]]);

    const options = fixture.nativeElement.querySelectorAll(
      '.token-select-panel__item'
    );
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('USDC');
  });

  it('should mark the selected token in the list', () => {
    component.selectedSymbol = 'USDC';
    fixture.detectChanges();

    const selected = fixture.nativeElement.querySelector(
      '.token-select-panel__item--selected'
    );

    expect(selected?.textContent).toContain('USDC');
    expect(selected?.getAttribute('aria-selected')).toBe('true');
  });

  it('should emit tokenSelected when a token is chosen', () => {
    const emitSpy = spyOn(component.tokenSelected, 'emit');

    component.handleSelect(tokens[1]);

    expect(emitSpy).toHaveBeenCalledWith(tokens[1]);
  });

  it('should emit closeRequested when close is clicked', () => {
    const emitSpy = spyOn(component.closeRequested, 'emit');

    component.handleClose();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit closeRequested from the close button', () => {
    const emitSpy = spyOn(component.closeRequested, 'emit');
    const closeButton = fixture.nativeElement.querySelector(
      '.token-select-panel__close'
    ) as HTMLButtonElement;

    closeButton.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('should emit tokenSelected when a list item is clicked', () => {
    const emitSpy = spyOn(component.tokenSelected, 'emit');
    const firstOption = fixture.nativeElement.querySelector(
      '.token-select-panel__item'
    ) as HTMLButtonElement;

    firstOption.click();

    expect(emitSpy).toHaveBeenCalledWith(tokens[0]);
  });

  it('should render loading status when assets are loading', () => {
    component.loading = true;
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector(
      '.token-select-panel__status'
    );

    expect(status?.textContent?.trim()).toBe('Loading assets...');
    expect(
      fixture.nativeElement.querySelector('.token-select-panel__list')
    ).toBeNull();
  });

  it('should render error status when asset loading fails', () => {
    component.loadError = 'Failed to load assets.';
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector(
      '.token-select-panel__status--error'
    );

    expect(status?.textContent?.trim()).toBe('Failed to load assets.');
  });

  it('should render empty status when no tokens are available', () => {
    component.tokens = [];
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector(
      '.token-select-panel__status'
    );

    expect(status?.textContent?.trim()).toBe('No assets available.');
  });
});
