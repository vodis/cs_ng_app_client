import QRCodeStyling from '../../../../shims/qr-code-styling';

const QR_SIZE = 280;
const ORANGE = '#FE6C00';
const DARK = '#080708';

/**
 * Builds a scannable QR with a cleared center for a token logo/letter.
 * Uses qr-code-styling hideBackgroundDots so modules under the badge are
 * omitted instead of covered (keeps Error Correction H effective).
 */
export async function buildDepositQrDataUrl(options: {
  address: string;
  symbol: string;
  iconUrl?: string | null;
}): Promise<string> {
  const image =
    (await resolveQrImage(options.iconUrl, options.symbol)) ||
    buildLetterBadgeDataUrl(options.symbol);

  const qr = new QRCodeStyling({
    width: QR_SIZE,
    height: QR_SIZE,
    type: 'canvas',
    data: options.address,
    image,
    margin: 8,
    qrOptions: {
      errorCorrectionLevel: 'H',
    },
    imageOptions: {
      hideBackgroundDots: true,
      imageSize: 0.28,
      margin: 6,
      crossOrigin: 'anonymous',
    },
    dotsOptions: {
      type: 'square',
      color: DARK,
    },
    cornersSquareOptions: {
      type: 'square',
      color: DARK,
    },
    cornersDotOptions: {
      type: 'square',
      color: DARK,
    },
    backgroundOptions: {
      color: '#ffffff',
    },
  });

  const blob = await qr.getRawData('png');
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('QR generation returned no image data');
  }
  return blobToDataUrl(blob);
}

async function resolveQrImage(
  iconUrl: string | null | undefined,
  symbol: string
): Promise<string> {
  if (!iconUrl) {
    return buildLetterBadgeDataUrl(symbol);
  }
  try {
    const loaded = await loadImageAsDataUrl(iconUrl);
    return loaded || buildLetterBadgeDataUrl(symbol);
  } catch {
    return buildLetterBadgeDataUrl(symbol);
  }
}

function buildLetterBadgeDataUrl(symbol: string): string {
  const letter = symbol.trim().charAt(0).toUpperCase() || '?';
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return '';
  }

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 64px Aeonik, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2 + 2);

  return canvas.toDataURL('image/png');
}

function loadImageAsDataUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 4, 4, size - 8, size - 8);
      ctx.restore();
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Icon load failed'));
    img.src = url;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read QR blob'));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
