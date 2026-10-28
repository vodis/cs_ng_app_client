/**
 * Browser-only wrapper around qr-code-styling.
 * Import this file instead of the package so we never load its Node-oriented
 * .d.ts (canvas / jsdom / Buffer).
 */
import QrCodeStylingCtor from 'qr-code-styling/lib/qr-code-styling.js';

export type QrErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';
export type QrFileExtension = 'svg' | 'png' | 'jpeg' | 'webp';

export type QrCodeStylingOptions = {
  width?: number;
  height?: number;
  type?: 'canvas' | 'svg';
  data?: string;
  image?: string;
  margin?: number;
  qrOptions?: {
    errorCorrectionLevel?: QrErrorCorrectionLevel;
  };
  imageOptions?: {
    hideBackgroundDots?: boolean;
    imageSize?: number;
    crossOrigin?: string;
    margin?: number;
  };
  dotsOptions?: {
    type?: string;
    color?: string;
  };
  cornersSquareOptions?: {
    type?: string;
    color?: string;
  };
  cornersDotOptions?: {
    type?: string;
    color?: string;
  };
  backgroundOptions?: {
    color?: string;
  };
};

export type QrCodeStylingInstance = {
  getRawData: (extension?: QrFileExtension) => Promise<Blob | null>;
};

type QrCodeStylingConstructor = new (
  options: QrCodeStylingOptions
) => QrCodeStylingInstance;

const QRCodeStyling = QrCodeStylingCtor as QrCodeStylingConstructor;

export default QRCodeStyling;
