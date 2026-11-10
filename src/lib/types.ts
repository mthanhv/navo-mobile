/** Response shapes of navo-api (see navo-api/README.md). Decimals are strings. */
export type Severity = "critical" | "warning" | "info" | "done";
export type Flag = { code: string; severity: Severity; params?: Record<string, string> };

export type LineRow = {
  contract_line_id: string;
  contract_id: string;
  contract_number: string;
  customer_name: string;
  owner_id: string;
  owner_name: string;
  line_no: number;
  name_on_contract: string;
  unit: string;
  contract_quantity: string;
  ordered: string;
  received: string;
  delivered: string;
  remaining: string;
  over: string;
  available: string;
  due_on: string | null;
  next_delivery: { number: string; planned_on: string; firmness: "tentative" | "firm"; quantity: string } | null;
  flags: Flag[];
  last_business_change_at: string;
};

export type Task = { id: string; title: string; due_on: string | null; customer_id: string | null; customer_name: string | null; contract_id: string | null; contract_number: string | null; done_at: string | null };
export type Note = { id: string; client_id: string; customer_id: string; customer_name: string; contract_id: string | null; contract_number: string | null; body: string; written_at: string; author: string; tasks: Task[] };
export type POSummary = { id: string; number: string; status: string; contract_id: string; contract_number: string; customer_name: string; supplier_name: string; lines: number; lines_fully_received: number; next_expected_on: string | null; late: boolean };

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
  value?: string;
  final_due_on?: string | null;
  lines?: LineRow[];
  summary?: { lines: number; fully_ordered: number; fully_received: number; fully_delivered: number };
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
};

export type PurchaseOrder = {
  id: string;
  number: string;
  contract_id: string;
  contract_number: string;
  supplier_id: string;
  supplier_name: string;
  status: "draft" | "confirmed" | "cancelled";
  currency: string;
  lines: POLine[];
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
};

export type Documents = { purchase_orders: PurchaseOrder[]; goods_receipts: GoodsReceipt[]; delivery_orders: DeliveryOrder[] };

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
};

export type Organization = { id: string; code: string; name: string; is_customer: boolean; is_supplier: boolean; tax_code: string | null };
export type Product = { id: string; name: string; manufacturer: string | null; manufacturer_code: string | null; unit: string };
export type User = { id: string; email: string; full_name: string; is_active: boolean; roles: string[]; grants: string[] };
export type Me = { user: { id: string; full_name: string; email: string; roles: string[]; grants: string[] }; permissions: string[] };
