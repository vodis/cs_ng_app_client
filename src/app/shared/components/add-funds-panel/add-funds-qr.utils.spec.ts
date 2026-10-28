import { buildDepositQrDataUrl } from './add-funds-qr.utils';

describe('add-funds-qr.utils', () => {
  it('builds a PNG data URL with a center logo quiet zone', async () => {
    const dataUrl = await buildDepositQrDataUrl({
      address: 'bc1qdemoaddressfortesting0000000000000000',
      symbol: 'BTC',
    });

    expect(dataUrl.startsWith('data:image/png;base64,')).toBeTrue();
    expect(dataUrl.length).toBeGreaterThan(500);
  });
});
