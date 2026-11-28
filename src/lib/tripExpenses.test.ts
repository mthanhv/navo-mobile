/// <reference types="jest" />
import { emptyExpenseForm, fillFromReceipt, receiptHasValues, type Receipt } from "./tripExpenses";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn() }));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("expo-crypto", () => ({ randomUUID: () => "id" }));
jest.mock("./api", () => ({ upload: jest.fn(), api: jest.fn(), API_URL: "x" }));
jest.mock("./drafts", () => ({ draftOwner: () => "owner" }));

const receipt = (over: Partial<Receipt> = {}): Receipt => ({
  category: "hotel", spent_on: "2026-11-25", amount: "1250000", vat_amount: "125000", currency: "VND",
  invoice_number: "1C26TXX 0000881", seller: "Khách sạn Sông Trà", seller_tax_code: "4300123456", ...over,
});

test("a blank form takes the receipt, the date shown as dd/mm/yyyy", () => {
  const { form, filled } = fillFromReceipt(emptyExpenseForm(""), receipt(), false);
  expect(form).toMatchObject({ category: "hotel", spent_on: "25/11/2026", amount: "1250000", vat_amount: "125000", seller: "Khách sạn Sông Trà" });
  expect(filled).toHaveLength(7);
  expect(filled).toEqual(expect.arrayContaining(["spent_on", "amount", "category"]));
});

test("what was typed and a category chosen by hand are kept", () => {
  const typed = { ...emptyExpenseForm("27/11/2026"), category: "meal" as const, amount: "300000" };
  const { form } = fillFromReceipt(typed, receipt(), true);
  expect(form.category).toBe("meal");
  expect(form.amount).toBe("300000");
  expect(form.spent_on).toBe("25/11/2026");
});

test("an empty reading fills nothing", () => {
  const nothing = receipt({ category: null, spent_on: null, amount: null, vat_amount: null, invoice_number: null, seller: null, seller_tax_code: null });
  expect(receiptHasValues(nothing)).toBe(false);
  expect(fillFromReceipt(emptyExpenseForm("x"), nothing, false).filled).toEqual([]);
});
