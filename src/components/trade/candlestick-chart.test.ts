import { describe, expect, it } from "vitest";

import { resolveChartSize } from "./candlestick-chart";

describe("resolveChartSize", () => {
  it("uses the compact container height instead of forcing a 320px chart", () => {
    expect(resolveChartSize(390, 220)).toEqual({ width: 390, height: 220 });
  });

  it("keeps the chart library dimensions positive before layout settles", () => {
    expect(resolveChartSize(0, 0)).toEqual({ width: 1, height: 1 });
  });
});
