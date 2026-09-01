import Decimal from "decimal.js";

function groupWholeDigits(value: string): string {
  const sign = value.startsWith("-") ? "-" : "";
  const digits = sign ? value.slice(1) : value;
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatSpotPrice(value: string, tickSize: string, quoteSymbol: string): string {
  const precision = new Decimal(tickSize).decimalPlaces();
  const [whole, fraction] = new Decimal(value).toFixed(precision).split(".");
  return `${groupWholeDigits(whole)}${fraction === undefined ? "" : `.${fraction}`} ${quoteSymbol}`;
}
