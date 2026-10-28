/** Backend-validated receive instructions for one selected asset/network. */
export interface DepositInstructions {
  amount: string;
  minimumReceived: string;
  assetId: string;
  address: string;
  expiresAt: string;
  memo?: string;
}

export function usableDepositInstructions(
  instructions: DepositInstructions | null,
  assetId: string,
  now = Date.now()
): instructions is DepositInstructions {
  return (
    !!instructions &&
    instructions.assetId === assetId &&
    instructions.address.length > 0 &&
    instructions.address === instructions.address.trim() &&
    !/\s/.test(instructions.address) &&
    Number.isFinite(Date.parse(instructions.expiresAt)) &&
    Date.parse(instructions.expiresAt) > now &&
    (instructions.memo === undefined || instructions.memo.trim().length > 0)
  );
}
