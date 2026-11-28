import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { api, API_URL, upload, type LocalFile } from "./api";
import { draftOwner } from "./drafts";
import type { Trip, TripCategory } from "./types";
import { TRIP_CATEGORIES } from "./types";

/** What navo-api read from a trip receipt (POST /ai/receipt-read); null where not printed. */
export type Receipt = {
  category: TripCategory | null; spent_on: string | null; amount: string | null; vat_amount: string | null; currency: string | null;
  invoice_number: string | null; seller: string | null; seller_tax_code: string | null;
};

/** The expense form on the phone; amounts as typed (the screen parses them on save). */
export type ExpenseForm = {
  category: TripCategory; spent_on: string; amount: string; vat_amount: string; invoice_number: string; seller: string; seller_tax_code: string; note: string;
};

export const emptyExpenseForm = (day: string): ExpenseForm => ({ category: "fuel", spent_on: day, amount: "", vat_amount: "", invoice_number: "", seller: "", seller_tax_code: "", note: "" });

export function readReceipt(photo: LocalFile): Promise<Receipt> {
  return upload<Receipt>("/ai/receipt-read", {}, photo);
}

export function receiptHasValues(r: Receipt): boolean {
  return [r.spent_on, r.amount, r.vat_amount, r.invoice_number, r.seller, r.seller_tax_code].some((v) => !!v?.trim());
}

/**
 * Fills the fields still empty, so nothing typed while the receipt was being read is overwritten;
 * the date (the form starts on today) and the category (while not chosen by hand) take the
 * receipt's. Dates come back as yyyy-mm-dd and are shown as dd/mm/yyyy. Returns the new form and
 * the fields it filled, which the form marks for checking.
 */
export function fillFromReceipt(form: ExpenseForm, r: Receipt, categoryTouched: boolean): { form: ExpenseForm; filled: (keyof ExpenseForm)[] } {
  const filled: (keyof ExpenseForm)[] = [];
  const pick = (key: keyof ExpenseForm, current: string, read: string | null | undefined) => {
    if (current.trim() || !read?.trim()) return current;
    filled.push(key);
    return read.trim();
  };
  const day = r.spent_on && /^\d{4}-\d{2}-\d{2}$/.test(r.spent_on) ? `${r.spent_on.slice(8, 10)}/${r.spent_on.slice(5, 7)}/${r.spent_on.slice(0, 4)}` : null;
  const next: ExpenseForm = {
    ...form,
    spent_on: r.spent_on && day ? (filled.push("spent_on"), day) : form.spent_on,
    amount: pick("amount", form.amount, r.amount),
    vat_amount: pick("vat_amount", form.vat_amount, r.vat_amount),
    invoice_number: pick("invoice_number", form.invoice_number, r.invoice_number),
    seller: pick("seller", form.seller, r.seller),
    seller_tax_code: pick("seller_tax_code", form.seller_tax_code, r.seller_tax_code),
  };
  if (!categoryTouched && r.category && TRIP_CATEGORIES.includes(r.category) && r.category !== form.category) {
    next.category = r.category;
    filled.push("category");
  }
  return { form: next, filled };
}

/**
 * Expense lines waiting to be sent (no signal on the road). Kept per installation and user like
 * field-note drafts; each line is sent once (client_id) and its receipt once (its own id), with a
 * checkpoint in between, so a lost answer never saves twice.
 */
export type PendingExpense = {
  id: string; ownerKey: string; tripId: string; tripNumber: string;
  body: { category: TripCategory; spent_on: string; amount: string; vat_amount: string; invoice_number: string | null; seller: string | null; seller_tax_code: string | null; note: string | null };
  photo: (LocalFile & { id: string }) | null; lineId?: string; photoSent?: boolean; savedAt: string;
};

const key = () => `navo.tripExpenses.v1:${encodeURIComponent(API_URL)}:${draftOwner()}`;
let writes: Promise<unknown> = Promise.resolve();
const sending = new Map<string, Promise<Trip | null>>();

export async function listPending(tripId?: string): Promise<PendingExpense[]> {
  let k: string;
  try { k = key(); } catch { return []; }
  await writes;
  const raw = await AsyncStorage.getItem(k);
  const all: PendingExpense[] = raw ? JSON.parse(raw) : [];
  return all.filter((p) => p.ownerKey === draftOwner() && (!tripId || p.tripId === tripId));
}

function mutate(fn: (all: PendingExpense[]) => PendingExpense[]) {
  const k = key();
  const op = writes.catch(() => undefined).then(async () => {
    const raw = await AsyncStorage.getItem(k);
    await AsyncStorage.setItem(k, JSON.stringify(fn(raw ? JSON.parse(raw) : [])));
  });
  writes = op.catch(() => undefined);
  return op;
}

/** Keeps the line (and a durable copy of its receipt photo) until it is sent. */
export async function queueExpense(tripId: string, tripNumber: string, body: PendingExpense["body"], photo: LocalFile | null): Promise<PendingExpense> {
  const id = Crypto.randomUUID();
  let kept: PendingExpense["photo"] = null;
  if (photo && FileSystem.documentDirectory) {
    const dir = `${FileSystem.documentDirectory}navo-trip-expenses/${id}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const uri = `${dir}receipt.jpg`;
    await FileSystem.copyAsync({ from: photo.uri, to: uri });
    kept = { ...photo, uri, id: Crypto.randomUUID() };
  }
  const p: PendingExpense = { id, ownerKey: draftOwner(), tripId, tripNumber, body, photo: kept, savedAt: new Date().toISOString() };
  await mutate((all) => [...all, p]);
  return p;
}

/** Drops a waiting line the API refused (the person corrects and saves it again). */
export async function removePending(id: string) {
  await mutate((all) => all.filter((x) => x.id !== id));
  if (FileSystem.documentDirectory) {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}navo-trip-expenses/${id}/`, { idempotent: true }).catch(() => undefined);
  }
}

/** Sends one waiting line; null when it is already gone (sent by another attempt). */
export function sendPending(p: PendingExpense): Promise<Trip | null> {
  const existing = sending.get(p.id);
  if (existing) return existing;
  const run = send(p).finally(() => sending.delete(p.id));
  sending.set(p.id, run);
  return run;
}

async function send(p: PendingExpense): Promise<Trip | null> {
  let current = (await listPending()).find((x) => x.id === p.id);
  if (!current) return null;
  let trip: Trip | null = null;
  if (!current.lineId) {
    trip = await api<Trip>(`/trips/${current.tripId}/expenses`, { method: "POST", body: { client_id: current.id, ...current.body } });
    const line = (trip.expenses ?? []).find((l) => l.client_id === current!.id);
    current = { ...current, lineId: line?.id };
    const saved = current;
    await mutate((all) => all.map((x) => (x.id === saved.id ? saved : x)));
  }
  if (current.photo && current.lineId && !current.photoSent) {
    await upload("/files", { owner_type: "trip_expense", owner_id: current.lineId, doc_kind: "receipt_photo", client_id: current.photo.id }, current.photo);
  }
  await mutate((all) => all.filter((x) => x.id !== current!.id));
  if (FileSystem.documentDirectory) {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}navo-trip-expenses/${current.id}/`, { idempotent: true }).catch(() => undefined);
  }
  return trip;
}
