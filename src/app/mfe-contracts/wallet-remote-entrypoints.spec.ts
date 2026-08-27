import {
  WALLET_REMOTE_ENTRY_FILE,
  resolveWalletRemoteEntryUrl,
} from './wallet-remote-entrypoints';

describe('resolveWalletRemoteEntryUrl', () => {
  it('appends remoteEntry.js to a pure origin', () => {
    expect(resolveWalletRemoteEntryUrl('https://wallets.craftscript.com')).toBe(
      `https://wallets.craftscript.com/${WALLET_REMOTE_ENTRY_FILE}`
    );
  });

  it('strips a trailing slash before appending remoteEntry.js', () => {
    expect(resolveWalletRemoteEntryUrl('http://localhost:5002/')).toBe(
      `http://localhost:5002/${WALLET_REMOTE_ENTRY_FILE}`
    );
  });

  it('does not duplicate remoteEntry.js when already present', () => {
    expect(
      resolveWalletRemoteEntryUrl(
        `https://staging-wallets.craftscript.com/${WALLET_REMOTE_ENTRY_FILE}`
      )
    ).toBe(
      `https://staging-wallets.craftscript.com/${WALLET_REMOTE_ENTRY_FILE}`
    );
  });
});
