import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ExchangeToken } from '@shared/models/exchange-token.model';
import { TokenSelectPanelComponent } from './token-select-panel.component';

describe('TokenSelectPanelComponent', () => {
  const tokens: ExchangeToken[] = [
    {
      symbol: 'USDC',
      name: 'USD Coin',
      assetId: 'usdc-asset',
      color: '#2f8cff',
      blockchain: 'eth',
    },
    {
      symbol: 'NEAR',
      name: 'NEAR Protocol',
      assetId: 'near-asset',
      color: '#2fd17c',
      blockchain: 'near',
    },
  ];

  let component: TokenSelectPanelComponent;
  let fixture: ComponentFixture<TokenSelectPanelComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
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
    component.excludedAssetId = 'near-asset';
    fixture.detectChanges();

    expect(component.availableTokens).toEqual([tokens[0]]);

    const options = fixture.nativeElement.querySelectorAll(
      '.token-select-panel__item'
    );
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('USDC');
  });

  it('should mark the selected token in the list', () => {
    component.selectedAssetId = 'usdc-asset';
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

  it('requires a network selection for destination assets', () => {
    const emitSpy = spyOn(component.tokenSelected, 'emit');
    component.showNetworkStep = true;
    component.tokens = [
      tokens[0],
      { ...tokens[0], assetId: 'usdc-near', blockchain: 'near' },
    ];

    component.handleSelect(tokens[0]);
    expect(component.pendingSymbol).toBe('USDC');
    expect(component.networkOptions.length).toBe(2);
    expect(emitSpy).not.toHaveBeenCalled();

    component.handleNetworkSelect(component.networkOptions[1]);
    expect(emitSpy).toHaveBeenCalledWith(component.tokens[1]);
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

  it('should filter tokens by name or symbol', () => {
    component.filterQuery = 'near';
    fixture.detectChanges();

    expect(component.filteredTokens).toEqual([tokens[1]]);

    const options = fixture.nativeElement.querySelectorAll(
      '.token-select-panel__item'
    );
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain('NEAR');
  });

  it('shows wallet tokens between search and the full token list', () => {
    component.showWalletTokens = true;
    component.walletTokens = [
      { token: tokens[1], balanceLabel: '1.25 NEAR', stale: false },
    ];
    fixture.detectChanges();

    const search = fixture.nativeElement.querySelector(
      '.token-select-panel__search'
    ) as HTMLElement;
    const walletSection = fixture.nativeElement.querySelector(
      '.token-select-panel__wallet-tokens'
    ) as HTMLElement;
    const fullList = fixture.nativeElement.querySelector(
      '.token-select-panel__section-label--all'
    ) as HTMLElement;

    expect(
      search.compareDocumentPosition(walletSection) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      walletSection.compareDocumentPosition(fullList) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(walletSection.textContent).toContain('NEAR_NEAR');
    expect(walletSection.textContent).toContain('1.25 NEAR');
    expect(walletSection.textContent).toContain('Available');
  });

  it('selects the exact network asset from the wallet-token section', () => {
    const emitSpy = spyOn(component.tokenSelected, 'emit');
    component.showWalletTokens = true;
    component.walletTokens = [
      { token: tokens[1], balanceLabel: '1.25 NEAR', stale: false },
    ];
    fixture.detectChanges();

    const option = fixture.nativeElement.querySelector(
      '.token-select-panel__item--wallet'
    ) as HTMLButtonElement;
    option.click();

    expect(emitSpy).toHaveBeenCalledWith(tokens[1]);
  });

  it('filters wallet tokens with the shared search query', () => {
    component.showWalletTokens = true;
    component.walletTokens = [
      { token: tokens[1], balanceLabel: '1.25 NEAR', stale: false },
    ];
    component.filterQuery = 'usdc';
    fixture.detectChanges();

    expect(component.filteredWalletTokens).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('.token-select-panel__wallet-tokens')
        ?.textContent
    ).toContain('No matching wallet tokens.');
  });

  it('should show no matching tokens message when filter has no results', () => {
    component.filterQuery = 'btc';
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector(
      '.token-select-panel__status'
    );

    expect(status?.textContent?.trim()).toBe('No matching tokens.');
    expect(
      fixture.nativeElement.querySelector('.token-select-panel__item')
    ).toBeNull();
  });

  it('should reset filter when panel opens', () => {
    component.filterQuery = 'near';
    component.isOpen = true;
    component.ngOnChanges({
      isOpen: {
        currentValue: true,
        previousValue: false,
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.filterQuery).toBe('');
  });
});
