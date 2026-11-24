/** Role-based screen choices. Permissions still decide what each action may do (the API checks). */

const WHOLE_COMPANY_DESK = ["delivery", "accounting", "admin"];

/** Sellers (sales, sales manager) start on their day; delivery, accounting and admin on the company overview. */
export function homeIsToday(roles: string[]) {
  return roles.some((r) => r === "sales" || r === "sales_manager") && !roles.some((r) => WHOLE_COMPANY_DESK.includes(r));
}

/** A plain salesperson sees awaited goods on "Today"; everyone else who reads contracts gets the Orders tab. */
export function showsOrdersTab(roles: string[]) {
  return !roles.every((r) => r === "sales");
}

/** Technicians read no contracts: their home is the visits assigned to them. */
export function homeIsVisits(can: (permission: string) => boolean) {
  return !can("contracts.read") && can("service.perform");
}
