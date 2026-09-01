import Decimal from "decimal.js";

const TOKEN_DECIMALS = 6;
const TOKEN_DISPLAY_FLOOR = new Decimal(10).pow(-TOKEN_DECIMALS);

export function isNonZeroBalance(value: string): boolean {
  try {
    return !new Decimal(value).isZero();
  } catch {
    return false;
  }
}

export function formatEquity(value: string): string {
  try {
    const normalized = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed();
    return groupIntegerDigits(normalized);
  } catch {
    return "—";
  }
}

export function formatTokenBalance(value: string): string {
  try {
    const amount = new Decimal(value);
    if (amount.isZero()) return "0";
    if (amount.abs().lessThan(TOKEN_DISPLAY_FLOOR)) return amount.isNegative() ? ">-0.000001" : "<0.000001";
    return amount.toDecimalPlaces(TOKEN_DECIMALS, Decimal.ROUND_DOWN).toFixed(TOKEN_DECIMALS).replace(/\.?0+$/, "");
  } catch {
    return "—";
  }
}

function groupIntegerDigits(value: string): string {
  const [integer, decimal] = value.split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decimal ? `${grouped}.${decimal}` : grouped;
}
