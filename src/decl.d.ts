declare module 'mfe-wallets/*';

/** Runtime JS entry — avoids package root .d.ts that imports Node canvas/jsdom. */
declare module 'qr-code-styling/lib/qr-code-styling.js' {
  // Constructor shape is asserted in src/shims/qr-code-styling.ts.
  const QRCodeStyling: new (...args: never[]) => {
    getRawData: (extension?: string) => Promise<Blob | null>;
  };
  export default QRCodeStyling;
}
