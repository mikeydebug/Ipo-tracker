import { Decimal } from "@prisma/client/runtime/library";

/**
 * Format a Decimal amount (stored in paise) as Indian Rupees string.
 * e.g. Decimal("150000") → "₹1,500.00"
 * Round only at display time, never mid-calculation.
 */
export function formatINR(paise: Decimal | number | string): string {
  const num = typeof paise === "object" ? paise.toNumber() : Number(paise);
  const rupees = num / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Convert a rupee input string/number (e.g. "1500" or 1500) to paise Decimal.
 * UI inputs are in rupees; we store in paise.
 */
export function rupeesToPaise(rupees: string | number): Decimal {
  const d = new Decimal(rupees.toString());
  return d.mul(new Decimal("100")).round();
}

/**
 * Convert paise Decimal to a rupee number for display-only purposes.
 */
export function paiseToRupees(paise: Decimal): number {
  return paise.div(new Decimal("100")).toNumber();
}

/**
 * Parse a string into a Decimal, throwing if invalid.
 * Use for all API input parsing of money fields.
 */
export function parseDecimal(value: unknown, fieldName: string): Decimal {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${fieldName} is required`);
  }
  try {
    const d = new Decimal(String(value));
    if (d.isNaN() || !d.isFinite()) throw new Error();
    return d;
  } catch {
    throw new Error(`${fieldName} must be a valid number`);
  }
}

/** Re-export Decimal so callers don't need to import from prisma runtime directly */
export { Decimal };
