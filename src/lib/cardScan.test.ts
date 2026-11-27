/// <reference types="jest" />
import { cardHasValues, emptyLeadForm, fillFromCard, type Card } from "./cardScan";

jest.mock("expo-image-manipulator", () => ({ ImageManipulator: {}, SaveFormat: { JPEG: "jpeg" } }));
jest.mock("./api", () => ({ upload: jest.fn() }));

const card = (over: Partial<Card> = {}): Card => ({
  company_name: "Công ty TNHH Kỹ thuật ABC", tax_code: "0312345678", address: "12 Nguyễn Huệ, Q.1", website: "abc.com.vn", company_phone: "028 3823 4567",
  person: { full_name: "Nguyễn Văn An", job_title: "Trưởng phòng mua hàng", phone: "0903 123 456", email: "an@abc.com.vn" },
  ...over,
});

test("a blank form takes every value the card gave", () => {
  const { form, filled } = fillFromCard(emptyLeadForm(), card());
  expect(filled).toBe(9);
  expect(form.name).toBe("Công ty TNHH Kỹ thuật ABC");
  expect(form.phone).toBe("028 3823 4567");
  expect(form.contact).toEqual({ full_name: "Nguyễn Văn An", job_title: "Trưởng phòng mua hàng", phone: "0903 123 456", email: "an@abc.com.vn" });
});

test("what was typed while the card was read is kept", () => {
  const typed = { ...emptyLeadForm(), name: "ABC", contact: { ...emptyLeadForm().contact, phone: "0909 000 000" } };
  const { form, filled } = fillFromCard(typed, card());
  expect(form.name).toBe("ABC");
  expect(form.contact.phone).toBe("0909 000 000");
  expect(filled).toBe(7);
  expect(fillFromCard(form, card()).filled).toBe(0);
});

test("a card without a company name names the lead after the person", () => {
  const { form } = fillFromCard(emptyLeadForm(), card({ company_name: null }));
  expect(form.name).toBe("Nguyễn Văn An");
});

test("an empty reading fills nothing", () => {
  const nothing = card({ company_name: null, tax_code: null, address: null, website: null, company_phone: null, person: { full_name: null, job_title: null, phone: " ", email: null } });
  expect(cardHasValues(nothing)).toBe(false);
  expect(fillFromCard(emptyLeadForm(), nothing).filled).toBe(0);
});
