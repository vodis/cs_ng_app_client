import { SimpleChange } from '@angular/core';
import { fakeAsync, tick } from '@angular/core/testing';
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
    expect(component.depositAddress).toBe('');
    expect(component.qrDataUrl).toBe('');
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

  it('requests instructions without inventing an address', () => {
    const request = spyOn(component.depositRequested, 'emit');
    component.selectNetwork(usdcEth);
    expect(request).not.toHaveBeenCalled();
    component.changeAmount('1');
    component.requestDeposit();
    expect(request).toHaveBeenCalledOnceWith({ token: usdcEth, amount: '1' });
    expect(component.depositAddress).toBe('');
    expect(component.qrDataUrl).toBe('');
  });

  it('rejects instructions for a different selected asset', () => {
    component.depositInstructions = {
      amount: '1',
      minimumReceived: '0.9',
      assetId: usdcEth.assetId,
      address: 'receiver',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    component.selectNetwork(usdcBase);
    expect(component.depositAddress).toBe('');
  });

  it('clears expired instructions and does not create an address-only QR for a memo deposit', fakeAsync(() => {
    component.depositInstructions = {
      amount: '1',
      minimumReceived: '0.9',
      assetId: near.assetId,
      address: 'receiver.near',
      memo: '123',
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    };
    component.selectNetwork(near);
    component.changeAmount('1');
    component.requestDeposit();
    component.ngOnChanges({
      depositInstructions: new SimpleChange(
        null,
        component.depositInstructions,
        false
      ),
    });
    expect(component.depositAddress).toBe('receiver.near');
    expect(component.qrDataUrl).toBe('');
    tick(1000);
    expect(component.depositAddress).toBe('');
  }));

  it('hides a delayed quote after editing away from and back to its amount', () => {
    component.selectNetwork(near);
    component.changeAmount('1');
    component.requestDeposit();
    component.changeAmount('2');
    component.changeAmount('1');
    component.depositInstructions = {
      assetId: near.assetId,
      amount: '1',
      minimumReceived: '0.9',
      address: 'receiver.near',
      expiresAt: '2099-01-01T00:00:00Z',
    };
    component.ngOnChanges({
      depositInstructions: new SimpleChange(
        null,
        component.depositInstructions,
        false
      ),
    });
    expect(component.depositAddress).toBe('');
    expect(component.qrDataUrl).toBe('');
  });

  afterEach(() => component.ngOnDestroy());

  it('marks the address as copied when clipboard write succeeds', async () => {
    component.depositInstructions = {
      amount: '1',
      minimumReceived: '0.9',
      assetId: near.assetId,
      address: 'receiver.near',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
      memo: 'required-memo',
    };
    const group = component.allGroups.find(item => item.symbol === 'NEAR');
    component.selectGroup(group!);
    component.changeAmount('1');
    component.requestDeposit();
    component.ngOnChanges({
      depositInstructions: new SimpleChange(
        null,
        component.depositInstructions,
        false
      ),
    });
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
