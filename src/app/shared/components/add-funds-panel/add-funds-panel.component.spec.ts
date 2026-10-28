import type { ExchangeToken } from '@shared/models/exchange-token.model';
import { AddFundsPanelComponent } from './add-funds-panel.component';

describe('AddFundsPanelComponent', () => {
  let component: AddFundsPanelComponent;

  const usdcEth: ExchangeToken = {
    symbol: 'USDC',
    name: 'USD Coin',
    assetId: 'usdc-eth',
    blockchain: 'eth',
    color: '#2f8cff',
  };
  const usdcBase: ExchangeToken = {
    symbol: 'USDC',
    name: 'USD Coin',
    assetId: 'usdc-base',
    blockchain: 'base',
    color: '#2f8cff',
  };
  const near: ExchangeToken = {
    symbol: 'NEAR',
    name: 'NEAR',
    assetId: 'near:native',
    blockchain: 'near',
    color: '#2fd17c',
  };

  beforeEach(() => {
    component = new AddFundsPanelComponent();
    component.tokens = [usdcEth, usdcBase, near];
  });

  it('opens the network step for multi-network tokens', () => {
    const group = component.allGroups.find(item => item.symbol === 'USDC');
    expect(group).toBeTruthy();
    component.selectGroup(group!);

    expect(component.step).toBe('network');
    expect(component.selectedGroup?.symbol).toBe('USDC');
    expect(component.selectedToken).toBeNull();
  });

  it('auto-advances to deposit when only one network exists', async () => {
    const group = component.allGroups.find(item => item.symbol === 'NEAR');
    component.selectGroup(group!);

    expect(component.step).toBe('deposit');
    expect(component.selectedToken?.assetId).toBe('near:native');
    expect(component.depositAddress.startsWith('demo-')).toBeTrue();
    expect(component.networkLabel(component.selectedToken!)).toBe('NEAR');
  });

  it('keeps the token selection when going back from deposit to network', () => {
    const group = component.allGroups.find(item => item.symbol === 'USDC');
    component.selectGroup(group!);
    component.selectNetwork(usdcBase);

    component.handleBack();

    expect(component.step).toBe('network');
    expect(component.selectedGroup?.symbol).toBe('USDC');
    expect(component.selectedToken?.assetId).toBe('usdc-base');
    expect(component.depositAddress).toBe('');
  });

  it('skips the network step when going back from a single-network deposit', () => {
    const group = component.allGroups.find(item => item.symbol === 'NEAR');
    component.selectGroup(group!);
    expect(component.step).toBe('deposit');

    component.handleBack();

    expect(component.step).toBe('token');
    expect(component.selectedToken).toBeNull();
  });

  it('opens network change from deposit when multiple networks exist', () => {
    const group = component.allGroups.find(item => item.symbol === 'USDC');
    component.selectGroup(group!);
    component.selectNetwork(usdcEth);

    component.changeNetwork();

    expect(component.step).toBe('network');
    expect(component.canChangeNetwork).toBeTrue();
  });

  it('marks the address as copied when clipboard write succeeds', async () => {
    const group = component.allGroups.find(item => item.symbol === 'NEAR');
    component.selectGroup(group!);
    const writeText = jasmine.createSpy('writeText').and.resolveTo(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await component.copyAddress();

    expect(writeText).toHaveBeenCalledOnceWith(component.depositAddress);
    expect(component.copied).toBeTrue();
  });
});
