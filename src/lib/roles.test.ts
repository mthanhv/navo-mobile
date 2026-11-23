/// <reference types="jest" />
import { homeIsToday, showsOrdersTab } from "./roles";

describe("role screens", () => {
  it("sellers start on Today, desk roles on the overview", () => {
    expect(homeIsToday(["sales"])).toBe(true);
    expect(homeIsToday(["sales_manager"])).toBe(true);
    for (const r of ["delivery", "accounting", "admin"]) expect(homeIsToday([r])).toBe(false);
    expect(homeIsToday(["sales", "admin"])).toBe(false);
  });
  it("only a plain salesperson goes without the Orders tab", () => {
    expect(showsOrdersTab(["sales"])).toBe(false);
    for (const r of ["sales_manager", "delivery", "accounting", "admin"]) expect(showsOrdersTab([r])).toBe(true);
  });
});
