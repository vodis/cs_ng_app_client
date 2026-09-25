/// <reference types="jasmine" />

import {
  formatSlippagePercentLabel,
  isSlippagePresetBps,
  minimumReceivedAtomic,
  parseSlippagePercentInput,
  percentInputFromBps,
  sanitizeSlippagePercentInput,
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

  it('rejects values outside 0.01%-50% before rounding to basis points', () => {
    expect(parseSlippagePercentInput('0.01')).toBe(1);
    expect(parseSlippagePercentInput('0.005')).toBeNull();
    expect(parseSlippagePercentInput('0.009')).toBeNull();
    expect(parseSlippagePercentInput('50.004')).toBeNull();
    expect(parseSlippagePercentInput('50.01')).toBeNull();
    expect(parseSlippagePercentInput('49.995')).toBe(5_000);
  });

  it('allows either comma or dot as the decimal separator', () => {
    expect(sanitizeSlippagePercentInput('0.8')).toBe('0.8');
    expect(sanitizeSlippagePercentInput('0,8')).toBe('0,8');
    expect(parseSlippagePercentInput('0.8')).toBe(80);
    expect(parseSlippagePercentInput('0,8')).toBe(80);
    expect(parseSlippagePercentInput('12,5%')).toBe(1_250);
  });

  it('keeps only the first decimal separator when both appear', () => {
    expect(sanitizeSlippagePercentInput('0,5.2')).toBe('0,52');
    expect(sanitizeSlippagePercentInput('0.5,2')).toBe('0.52');
    expect(sanitizeSlippagePercentInput('1..2')).toBe('1.2');
    expect(sanitizeSlippagePercentInput('1,,2')).toBe('1,2');
    expect(parseSlippagePercentInput('0,5.2')).toBe(52);
    expect(parseSlippagePercentInput('0.5,2')).toBe(52);
  });

  it('strips letters from custom input', () => {
    expect(sanitizeSlippagePercentInput('0,епм')).toBe('0,');
    expect(sanitizeSlippagePercentInput('12abc.3.4')).toBe('12.34');
    expect(sanitizeSlippagePercentInput('1a,2b')).toBe('1,2');
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
