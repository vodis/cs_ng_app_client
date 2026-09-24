/// <reference types="jasmine" />

import {
  formatSlippagePercentLabel,
  isSlippagePresetBps,
  minimumReceivedAtomic,
  parseSlippagePercentInput,
  percentInputFromBps,
} from './slippage-settings.utils';

describe('slippage-settings utils', () => {
  it('formats preset and custom percent labels', () => {
    expect(formatSlippagePercentLabel(10)).toBe('0.1%');
    expect(formatSlippagePercentLabel(25)).toBe('0.25%');
    expect(formatSlippagePercentLabel(50)).toBe('0.5%');
    expect(formatSlippagePercentLabel(100)).toBe('1%');
    expect(formatSlippagePercentLabel(300)).toBe('3%');
  });

  it('parses custom percent input into basis points', () => {
    expect(parseSlippagePercentInput('0.1')).toBe(10);
    expect(parseSlippagePercentInput('0.25%')).toBe(25);
    expect(parseSlippagePercentInput('1')).toBe(100);
    expect(parseSlippagePercentInput('50')).toBe(5_000);
    expect(parseSlippagePercentInput('0')).toBeNull();
    expect(parseSlippagePercentInput('51')).toBeNull();
    expect(parseSlippagePercentInput('abc')).toBeNull();
  });

  it('round-trips custom inputs for non-preset values', () => {
    expect(percentInputFromBps(75)).toBe('0.75');
    expect(isSlippagePresetBps(75)).toBeFalse();
    expect(isSlippagePresetBps(50)).toBeTrue();
  });

  it('applies slippage to atomic receive amounts', () => {
    expect(minimumReceivedAtomic('1000000', 50)).toBe('995000');
    expect(minimumReceivedAtomic('100', 10_000)).toBeNull();
    expect(minimumReceivedAtomic('not-a-number', 50)).toBeNull();
  });
});
