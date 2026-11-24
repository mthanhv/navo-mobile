/** Response shapes of navo-api (see navo-api/README.md). Decimals are strings. */
export type Severity = "critical" | "warning" | "info" | "done";
export type Flag = { code: string; severity: Severity; params?: Record<string, string> };

export type LineRow = {
  contract_line_id: string;
  contract_id: string;
  contract_number: string;
  customer_id: string;
  customer_name: string;
  owner_id: string;
  owner_name: string;
  line_no: number;
  name_on_contract: string;
  unit: string;
  contract_quantity: string;
  /** Already inside received and delivered: what had happened by the opening cut-over. */
  opening_received?: string;
  opening_delivered?: string;
  ordered: string;
  received: string;
  delivered: string;
  accepted: string;
  /** Omitted for people without sales-price access (delivery). */
  unit_price?: string;
  remaining: string;
  over: string;
  available: string;
  /** On open plans (draft deliveries, dated or not) and what still needs a plan. */
  planned: string; unplanned: string;
  due_on: string | null;
  next_delivery: { number: string; planned_on: string; firmness: "tentative" | "firm"; quantity: string } | null;
  flags: Flag[];
  last_business_change_at: string;
};

export type Task = { id: string; title: string; due_on: string | null; customer_id: string | null; customer_name: string | null; contract_id: string | null; contract_number: string | null; done_at: string | null };
export type Note = { id: string; client_id: string; customer_id: string; customer_name: string; contract_id: string | null; contract_number: string | null; body: string; written_at: string; author: string; tasks: Task[] };
export type DOSummary = {
  id: string; number: string; status: "draft" | "confirmed" | "cancelled" | "reversed"; contract_id: string; contract_number: string; customer_name: string;
  planned_on: string | null; firmness: "tentative" | "firm"; delivered_on: string | null; lines: number; overdue: boolean; override_status: OverrideInfo["status"] | null;
};

export type POSummary = {
  id: string; number: string; status: "draft" | "confirmed" | "cancelled" | "reversed"; contract_id: string; contract_number: string; customer_name: string;
  supplier_name: string; lines: number; lines_fully_received: number; next_expected_on: string | null; late: boolean; override_status: OverrideInfo["status"] | null;
  due_this_week?: boolean;
};

export type Contract = {
  id: string;
  number: string | null;
  draft_number: string;
  status: "draft" | "active" | "closed" | "cancelled";
  customer_id: string;
  customer_code: string;
  customer_name: string;
  title: string;
  customer_reference: string | null;
  currency: string;
  signed_on: string | null;
  owner_id: string;
  owner_name: string;
  version: number;
  delivery_location: string | null;
  /** Omitted for people without sales-price access (delivery). */
  value?: string;
  /** Value plus VAT (per line rate, rounded to the currency unit); payment terms add up to it. */
  total?: string;
  /** Total minus the payment terms, when terms exist and no longer add up (after an amendment). */
  terms_difference?: string;
  final_due_on: string | null;
  lines?: LineRow[];
  summary?: { lines: number; fully_ordered: number; fully_received: number; fully_delivered: number; fully_accepted: number };
  /** From the opening balances: where it started; invoiced is for finance only. */
  opening?: { cutover_on: string; is_old_invoice: boolean; invoiced?: string };
  quotation?: { id: string; number: string; revision: number };
  progress?: { lines: number; fully_ordered: number; fully_received: number; fully_delivered: number };
  attention?: { count: number; flag: Flag | null; line_name?: string; unit?: string };
};

export type POLine = {
  id: string;
  contract_line_id: string;
  contract_line_no: number;
  name_on_contract: string;
  supplier_item_name: string | null;
  unit: string;
  quantity: string;
  cancelled_quantity?: string;
  unit_price?: string;
  expected_on: string | null;
  received: string;
  /** Still to arrive (quantity is already net of closed balances). */
  outstanding: string;
  late: boolean;
};

export type PurchaseOrder = {
  id: string;
  number: string;
  contract_id: string;
  contract_number: string;
  supplier_id: string;
  supplier_name: string;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  currency: string;
  confirmed_on: string | null;
  lines: POLine[];
  override: OverrideInfo | null;
  fully_received: boolean; late: boolean; days_late?: number; latest_expected_on: string | null;
};

export type GoodsReceipt = {
  id: string;
  number: string;
  purchase_order_id: string;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  received_on: string;
  lines: { purchase_order_line_id: string; contract_line_no: number; accepted_quantity: string; rejected_quantity: string }[];
};

export type DeliveryOrder = {
  id: string;
  number: string;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  planned_on: string | null;
  firmness: "tentative" | "firm";
  route: "via_company" | "direct";
  delivered_on: string | null;
  lines: { contract_line_id: string; contract_line_no: number; quantity: string }[];
  version: number;
  override: OverrideInfo | null;
};

export type Documents = {
  purchase_orders: PurchaseOrder[]; goods_receipts: GoodsReceipt[]; delivery_orders: DeliveryOrder[];
  amendments: Amendment[]; acceptances: EventDoc[]; customer_returns: EventDoc[]; supplier_returns: EventDoc[];
};
export type Overview = {
  as_of: string;
  active_contracts: number;
  lines_remaining: number;
  purchase_orders_awaiting_goods: number;
  flag_counts: Record<string, number>;
  needs_action: number;
  attention: LineRow[];
  upcoming: {
    id: string; number: string; contract_id: string; contract_number: string; customer_name: string; planned_on: string; firmness: "tentative" | "firm"; lines: number;
    item_name: string | null; quantity: string | null; unit: string | null;
  }[];
  line_status: { delivered: number; on_track: number; warning: number; critical: number };
  weekly: { week_start: string; delivered: number; planned: number }[];
  /** From the API: contracts with a late delivery; upcoming deliveries that are firm or tentative. */
  overdue_contracts: number; upcoming_firm: number; upcoming_tentative: number;
};

export type Organization = { id: string; code: string; name: string; is_customer: boolean; is_supplier: boolean; tax_code: string | null };
export type Product = { id: string; name: string; manufacturer: string | null; manufacturer_code: string | null; unit: string };
export type User = { id: string; email: string; full_name: string; is_active: boolean; roles: string[]; grants: string[] };
export type Me = { user: { id: string; full_name: string; email: string; roles: string[]; grants: string[]; mfa_enrollment_required?: boolean }; permissions: string[] };
export type OverrideInfo = { id: string; status: "pending" | "approved" | "rejected" | "withdrawn"; reason: string; decision_note: string | null };
export type EventDoc = {
  id: string; kind: "acceptance" | "customer_return" | "supplier_return"; number: string; on: string; note: string; status: "confirmed" | "reversed";
  purchase_order_id?: string; created_by: string;
  lines: { contract_line_id: string; purchase_order_line_id?: string; line_no: number; name_on_contract: string; unit: string; quantity: string }[];
};
export type Amendment = {
  id: string; number: string; signed_on: string; reference: string | null; reason: string; created_by: string; created_at: string;
  lines: { contract_line_id: string; line_no: number; change: "added" | "changed"; before: Record<string, unknown> | null; after: Record<string, unknown> }[];
};

