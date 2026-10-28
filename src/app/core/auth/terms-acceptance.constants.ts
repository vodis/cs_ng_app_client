/**
 * Host Terms acceptance prototype.
 *
 * Persistence is localStorage keyed by backend user id. This is intentionally
 * browser-local and must be replaced with a backend-backed acceptance record
 * before production enforcement across devices.
 */
export const TERMS_ACCEPTANCE_STORAGE_KEY =
  'craftscript.termsAcceptance.v1.prototype';

/** Bump when the published Terms text changes. */
export const CURRENT_TERMS_VERSION = '2026-10-21';

export type TermsAcceptanceRecord = {
  version: string;
  acceptedAt: string;
};

export type TermsAcceptanceStore = Record<string, TermsAcceptanceRecord>;

export const TERMS_DOCUMENT_PARAGRAPHS: readonly string[] = [
  'Welcome to CraftScript. By accessing or using the CraftScript dashboard, wallets, and related services, you agree to these Terms and Conditions.',
  'CraftScript provides software tools that help you view balances, request quotes, and interact with supported blockchain networks. CraftScript is not a custodian, exchange, broker, or financial adviser unless a specific product feature expressly states otherwise.',
  'You are responsible for safeguarding your devices, credentials, passkeys, recovery methods, and wallet keys. CraftScript cannot reverse irreversible blockchain transactions or recover assets lost through phishing, malware, or shared credentials.',
  'Market data, quotes, balances, and status indicators may be delayed, incomplete, or provided by third parties. You must verify critical details before confirming any transaction.',
  'Supported assets, networks, and funding paths may change. Backend policy decides whether a balance, quote, or transfer is valid. Client-side lists are for display only and do not authorize trading.',
  'You agree not to misuse the service, attempt unauthorized access, interfere with other users, or use CraftScript in violation of applicable law or sanctions restrictions.',
  'Features may depend on third-party providers (for example account auth, wallet connectors, or liquidity venues). Their outages or policy changes can affect availability.',
  'These Terms may be updated from time to time. When the published version changes, you may be asked to review and accept the updated Terms before continuing to use protected account features.',
  'If you do not agree to these Terms, do not use CraftScript account features. You may log out and discontinue use.',
  'This prototype copy is a host-side placeholder for product and legal review. Replace it with the approved Terms before production launch.',
];
