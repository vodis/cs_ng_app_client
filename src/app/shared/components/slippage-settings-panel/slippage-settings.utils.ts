/** Re-export shared slippage helpers from `@vodis/cs-ui` for existing host imports. */
export {
  DEFAULT_SLIPPAGE_TOLERANCE_BPS,
  MAX_SLIPPAGE_TOLERANCE_BPS,
  SLIPPAGE_PRESET_BPS,
  formatSlippagePercentLabel,
  isSlippagePresetBps,
  minimumReceivedAtomic,
  parseSlippagePercentInput,
  percentInputFromBps,
  sanitizeSlippagePercentInput,
  type SlippagePresetBps,
  type SwapPrivacyMode,
  type SwapRouteMode,
  type SwapSettingsSelection,
} from '@vodis/cs-ui';
