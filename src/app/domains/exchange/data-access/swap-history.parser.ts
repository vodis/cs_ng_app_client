import type { SwapHistoryItem } from '../models/swap-history.models';
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid swap history');
  return Object.fromEntries(Object.entries(value));
}
function text(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid swap history field');
  return value;
}
function atomic(value: unknown): string {
  const result = text(value);
  if (!/^\d+$/.test(result)) throw new Error('Invalid history amount');
  return result;
}
function decimals(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 30
  )
    throw new Error('Invalid asset decimals');
  return value;
}
function status(value: unknown): SwapHistoryItem['status'] {
  switch (value) {
    case 'KNOWN_DEPOSIT_TX':
    case 'PENDING_DEPOSIT':
    case 'INCOMPLETE_DEPOSIT':
    case 'PROCESSING':
    case 'SUCCESS':
    case 'REFUNDED':
    case 'FAILED':
    case 'UNKNOWN':
    case 'AWAITING_APPROVAL':
    case 'SUBMITTED':
    case 'CANCELLED':
      return value;
    default:
      throw new Error('Unknown swap history status');
  }
}
export function parseSwapHistory(value: unknown): {
  data: { items: SwapHistoryItem[]; nextCursor: string | null };
} {
  const data = record(record(value)['data']);
  const rows = data['items'];
  if (!Array.isArray(rows) || rows.length > 50)
    throw new Error('Invalid history page');
  return {
    data: {
      nextCursor: data['nextCursor'] === null ? null : text(data['nextCursor']),
      items: rows.map((value: unknown) => {
        const row = record(value);
        const preparationId = text(row['preparationId']);
        const createdAt = text(row['createdAt']);
        if (
          !/^[0-9a-f-]{36}$/i.test(preparationId) ||
          !Number.isFinite(Date.parse(createdAt))
        )
          throw new Error('Invalid history reference');
        const result: SwapHistoryItem = {
          preparationId,
          createdAt,
          status: status(row['status']),
          sourceSymbol: text(row['sourceSymbol']),
          destinationSymbol: text(row['destinationSymbol']),
          sourceDecimals: decimals(row['sourceDecimals']),
          destinationDecimals: decimals(row['destinationDecimals']),
          amountIn: atomic(row['amountIn']),
          amountOut: atomic(row['amountOut']),
          network: text(row['network']),
          destinationNetwork: text(row['destinationNetwork']),
          recipient: text(row['recipient']),
        };
        if (row['receipt']) {
          const receipt = record(row['receipt']);
          const entries = receipt['transactions'];
          if (!Array.isArray(entries)) throw new Error('Invalid receipt');
          result.receipt = {
            transactions: entries.slice(0, 40).map((entry: unknown) => {
              const tx = record(entry);
              const url = new URL(text(tx['explorerUrl']));
              if (url.protocol !== 'https:' || url.username || url.password)
                throw new Error('Invalid explorer URL');
              return { hash: text(tx['hash']), explorerUrl: url.href };
            }),
            ...(receipt['amountIn'] !== undefined
              ? { amountIn: atomic(receipt['amountIn']) }
              : {}),
            ...(receipt['amountOut'] !== undefined
              ? { amountOut: atomic(receipt['amountOut']) }
              : {}),
            ...(receipt['refundedAmount'] !== undefined
              ? { refundedAmount: atomic(receipt['refundedAmount']) }
              : {}),
          };
        }
        return result;
      }),
    },
  };
}
