export type TokenSelectPanelViewState = 'loading' | 'error' | 'empty' | 'ready';

export interface TokenSelectPanelViewModel {
  state: TokenSelectPanelViewState;
  statusMessage: string;
  isError: boolean;
}

export interface TokenSelectPanelViewInput {
  loading: boolean;
  loadError: string;
  availableTokenCount: number;
}

export function resolveTokenSelectPanelViewModel(
  input: TokenSelectPanelViewInput
): TokenSelectPanelViewModel {
  if (input.loading) {
    return {
      state: 'loading',
      statusMessage: 'Loading assets...',
      isError: false,
    };
  }

  if (input.loadError) {
    return {
      state: 'error',
      statusMessage: input.loadError,
      isError: true,
    };
  }

  if (input.availableTokenCount === 0) {
    return {
      state: 'empty',
      statusMessage: 'No assets available.',
      isError: false,
    };
  }

  return {
    state: 'ready',
    statusMessage: '',
    isError: false,
  };
}
