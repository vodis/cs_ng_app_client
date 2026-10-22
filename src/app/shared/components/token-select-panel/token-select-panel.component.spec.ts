import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import type { ExchangeToken } from '@shared/models/exchange-token.model';
import { TokenSelectPanelComponent } from './token-select-panel.component';

describe('TokenSelectPanelComponent', () => {
  const eth: ExchangeToken = {
    symbol: 'ETH',
    name: 'Ethereum',
    assetId: 'eth',
    color: '#627eea',
    blockchain: 'eth',
    sourceNetwork: 'eip155:1',
  };
  const nearEth = {
    ...eth,
    assetId: 'eth-near',
    blockchain: 'near',
    sourceNetwork: 'near:mainnet',
    contractAddress: 'eth.near',
  };
  let component: TokenSelectPanelComponent;
  let fixture: ComponentFixture<TokenSelectPanelComponent>;
  let element: HTMLElement;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormsModule],
      declarations: [TokenSelectPanelComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    });
    fixture = TestBed.createComponent(TokenSelectPanelComponent);
    component = fixture.componentInstance;
    element = fixture.nativeElement;
    component.tokens = [eth, nearEth];
    fixture.detectChanges();
  });
  const buttons = () =>
    element.querySelectorAll<HTMLButtonElement>('.token-select-panel__item');
  it('groups variants and emits only after selecting an exact network asset', () => {
    const emit = spyOn(component.tokenSelected, 'emit');
    expect(buttons().length).toBe(1);
    buttons()[0].click();
    fixture.detectChanges();
    expect(emit).not.toHaveBeenCalled();
    expect(buttons().length).toBe(2);
    expect(buttons()[1].textContent).toContain('ETH_NEAR');
    expect(buttons()[1].textContent).toContain('eth.near');
    buttons()[1].click();
    expect(emit).toHaveBeenCalledOnceWith(nearEth);
  });
  it('requires the network step even for one variant', () => {
    component.tokens = [eth];
    fixture.detectChanges();
    const emit = spyOn(component.tokenSelected, 'emit');
    buttons()[0].click();
    fixture.detectChanges();
    expect(emit).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Select ETH network');
    buttons()[0].click();
    expect(emit).toHaveBeenCalledOnceWith(eth);
  });
  it('searches contracts without hiding sibling networks in step two', () => {
    component.filterQuery = 'eth.near';
    fixture.detectChanges();
    expect(buttons().length).toBe(1);
    buttons()[0].click();
    fixture.detectChanges();
    expect(buttons().length).toBe(2);
    component.back();
    fixture.detectChanges();
    expect(component.filterQuery).toBe('eth.near');
    expect(buttons().length).toBe(1);
  });
  it('keeps wrapped and native token groups separate and excludes exact IDs', () => {
    component.tokens = [
      eth,
      nearEth,
      { ...eth, symbol: 'WETH', assetId: 'weth' },
    ];
    component.excludedAssetId = 'eth';
    fixture.detectChanges();
    expect(component.groups.map(group => group.symbol)).toEqual([
      'ETH',
      'WETH',
    ]);
    buttons()[0].click();
    fixture.detectChanges();
    expect(buttons().length).toBe(1);
    expect(buttons()[0].textContent).toContain('ETH_NEAR');
  });
  it('shows total holdings and emits the explicitly chosen funding wallet', () => {
    const wallet = {
      id: 'wallet',
      providerWalletId: 'provider',
      address: 'alice.near',
      chainType: 'near',
      walletType: 'external',
      isPrimary: false,
    };
    const balance = {
      walletId: wallet.id,
      walletAddress: wallet.address,
      chainType: 'near',
      network: 'near:mainnet',
      assetId: nearEth.assetId,
      symbol: 'ETH',
      decimals: 18,
      balanceRaw: '1000000000000000000',
      source: 'rpc',
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      stale: false,
    };
    component.showWalletTokens = true;
    component.fundingSelection = true;
    component.holdings = [
      { token: nearEth, wallet, network: balance.network, balance },
    ];
    fixture.detectChanges();
    expect(buttons()[0].textContent).toContain('1');
    buttons()[0].click();
    fixture.detectChanges();
    expect(element.textContent).toContain('No compatible linked wallet');
    const emit = spyOn(component.fundingSelected, 'emit');
    buttons()[0].click();
    expect(emit).toHaveBeenCalledOnceWith(component.holdings[0]);
    component.selectionBusy = true;
    fixture.detectChanges();
    expect(buttons()[0].disabled).toBeTrue();
  });
  it('displays retryable balance and selection errors', () => {
    component.showWalletTokens = true;
    component.balancesIncomplete = true;
    component.selectionError = 'Could not switch the active wallet.';
    fixture.detectChanges();
    expect(element.textContent).toContain('Totals may be incomplete');
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not switch'
    );
    const retry = spyOn(component.retryRequested, 'emit');
    Array.from(element.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Refresh balances'))
      ?.click();
    expect(retry).toHaveBeenCalled();
  });
  it('resets the network step on close and reports empty search/loading/error states', () => {
    component.openGroup(component.groups[0]);
    const close = spyOn(component.closeRequested, 'emit');
    component.handleClose();
    expect(close).toHaveBeenCalled();
    expect(component.selectedGroup).toBeUndefined();
    component.filterQuery = 'missing';
    fixture.detectChanges();
    expect(element.textContent).toContain('No matching tokens.');
    component.loading = true;
    fixture.detectChanges();
    expect(element.textContent).toContain('Loading assets...');
    component.loading = false;
    component.loadError = 'Catalog unavailable';
    fixture.detectChanges();
    expect(element.textContent).toContain('Catalog unavailable');
  });
});
