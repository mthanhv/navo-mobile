/// <reference types="jest" />
// Same cases as the web app: both clients must format decimals identically.
import { compareDecimal, formatDate, formatDecimal, formatMoney, parseDecimalInput } from "./format";

describe("decimal formatting", () => {
  it("groups without floats", () => {
    expect(formatDecimal("24000000", "vi")).toBe("24.000.000");
    expect(formatDecimal("980.5", "en", 2)).toBe("980.50");
    expect(formatDecimal("123456789012345678.123456", "vi")).toBe("123.456.789.012.345.678,123456");
  });
  it("formats money by currency", () => {
    expect(formatMoney("2592000000", "VND", "vi")).toBe("2.592.000.000 VND");
    expect(formatMoney("36200", "USD", "vi")).toBe("36.200,00 USD");
  });
  it("parses typed numbers per language and refuses junk", () => {
    expect(parseDecimalInput("1.250,5", "vi")).toBe("1250.5");
    expect(parseDecimalInput("1,250.5", "en")).toBe("1250.5");
    expect(parseDecimalInput("12abc", "vi")).toBeNull();
    expect(parseDecimalInput("-3", "vi")).toBeNull();
  });
  it("compares exactly", () => {
    expect(compareDecimal("0.3", "0.30")).toBe(0);
    expect(compareDecimal("100", "99.999999")).toBe(1);
    expect(compareDecimal("20", "21")).toBe(-1);
  });
  it("formats ISO dates without timezone shifts", () => {
    expect(formatDate("2026-11-09")).toBe("09/11/2026");
  });
});
