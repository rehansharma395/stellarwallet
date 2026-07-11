/**
 * Formats a 56-character Stellar public key into a readable short form.
 * e.g., GDCONDUITADMIN2026MARKETINGVAULTXX -> GDCONDUIT...AULTXX
 */
export function formatStellarAddress(address: string): string {
  if (!address || address.length !== 56) {
    return address || '';
  }
  return `${address.substring(0, 9)}...${address.substring(47)}`;
}

/**
 * Validates whether a string has a valid Stellar public key structure.
 * Must start with 'G', be alphanumeric, and exactly 56 characters.
 */
export function isValidStellarAddress(address: string): boolean {
  if (!address || address.length !== 56) {
    return false;
  }
  const regex = /^G[A-Z2-7]{55}$/;
  return regex.test(address);
}

/**
 * Converts raw Stroops to standard asset units (1 unit = 10,000,000 Stroops).
 */
export function stroopsToUnits(stroops: bigint | string | number): number {
  const stroopsVal = BigInt(stroops);
  return Number(stroopsVal) / 10_000_000;
}

/**
 * Converts standard asset units to raw Stroops (integer value).
 */
export function unitsToStroops(units: number): bigint {
  if (isNaN(units) || units < 0) {
    return 0n;
  }
  return BigInt(Math.round(units * 10_000_000));
}

/**
 * Calculates allocation distribution amounts across campaign target requirements.
 * e.g. calculates how much of the pooled total is routed to a target with a certain weight.
 */
export function calculateAllocation(totalAmount: number, weight: number, totalWeight: number): number {
  if (totalWeight <= 0 || weight < 0 || totalAmount <= 0) {
    return 0;
  }
  const rawAllocation = (totalAmount * weight) / totalWeight;
  // Round to 7 decimal places matching Stroops granularity
  return Math.round(rawAllocation * 10_000_000) / 10_000_000;
}
