import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import { api, API_URL, upload, type LocalFile } from "./api";
import type { Note } from "./types";

/** Drafts and durable photo assets belong to one installation and one user. */
export type Draft = {
  id: string;
  ownerKey: string;
  customerId: string;
  customerName: string;
  contractId: string | null;
  contractNumber: string | null;
  body: string;
  taskTitle: string;
  taskDue: string;
  photos: (LocalFile & { id?: string })[];
  writtenAt: string;
  noteId?: string;
  photosSent?: number;
};

let owner: string | null = null;
let writes: Promise<unknown> = Promise.resolve();
const sending = new Map<string, Promise<Note>>();
export function setDraftOwner(userID: string | null) {
  owner = userID ? `navo.noteDrafts.v2:${encodeURIComponent(API_URL)}:${userID}` : null;
}
export function draftOwner(): string {
  if (!owner) throw new Error("No signed-in draft owner");
  return owner;
}
function assertOwner(key: string) {
  if (key !== draftOwner()) throw new Error("Draft belongs to another account");
}
export const newDraftId = () => Crypto.randomUUID();

export async function listDrafts(): Promise<Draft[]> {
  if (!owner) return [];
  const key = owner;
  await writes;
  const raw = await AsyncStorage.getItem(key);
  if (key !== owner) return [];
  // Legacy unowned drafts are deliberately left quarantined, never assigned to a login.
  return raw ? (JSON.parse(raw) as Draft[]).filter((d) => d.ownerKey === key) : [];
}

function mutate(key: string, fn: (all: Draft[]) => Draft[]) {
  const operation = writes.catch(() => undefined).then(async () => {
    assertOwner(key);
    const raw = await AsyncStorage.getItem(key);
    const all: Draft[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(key, JSON.stringify(fn(all)));
  });
  writes = operation.catch(() => undefined);
  return operation;
}

export async function retainPhoto(draft: Draft, photo: LocalFile): Promise<LocalFile & { id: string }> {
  assertOwner(draft.ownerKey);
  if (!FileSystem.documentDirectory) throw new Error("Durable storage unavailable");
  const id = newDraftId();
  const dir = `${FileSystem.documentDirectory}navo-drafts/${encodeURIComponent(draft.ownerKey)}/${draft.id}/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const uri = `${dir}${id}`;
  await FileSystem.copyAsync({ from: photo.uri, to: uri });
  return { ...photo, uri, id };
}

export async function saveDraft(d: Draft) {
  assertOwner(d.ownerKey);
  await mutate(d.ownerKey, (all) => {
    const existing = all.find((x) => x.id === d.id);
    // Once sent, business content is immutable. Never overwrite a successful
    // note/photo checkpoint with the screen's older in-memory version.
    const next = existing?.noteId ? existing : d;
    return [...all.filter((x) => x.id !== d.id), next];
  });
}

async function checkpoint(d: Draft) {
  await mutate(d.ownerKey, (all) => [...all.filter((x) => x.id !== d.id), d]);
}

export async function removeDraft(id: string) {
  const key = draftOwner();
  await mutate(key, (all) => all.filter((x) => x.id !== id));
}

/** One in-flight send per draft; checkpoints and upload IDs survive uncertain responses. */
export function sendDraft(d: Draft): Promise<Note> {
  assertOwner(d.ownerKey);
  const key = `${d.ownerKey}:${d.id}`;
  const existing = sending.get(key);
  if (existing) return existing;
  const run = send(d).finally(() => sending.delete(key));
  sending.set(key, run);
  return run;
}

async function send(d: Draft): Promise<Note> {
  let current = (await listDrafts()).find((x) => x.id === d.id) ?? d;
  assertOwner(current.ownerKey);
  let note: Note;
  if (!current.noteId) {
    note = await api<Note>("/notes", { method: "POST", body: {
      client_id: current.id, customer_id: current.customerId, contract_id: current.contractId,
      body: current.body, written_at: current.writtenAt,
      task: current.taskTitle.trim() ? { title: current.taskTitle.trim(), due_on: current.taskDue || null } : undefined,
    } });
    assertOwner(current.ownerKey);
    current = { ...current, noteId: note.id, photosSent: 0 };
    await checkpoint(current);
  } else note = { id: current.noteId } as Note;
  // Persist upload identities before starting uploads, including older v2 drafts.
  current = { ...current, photos: current.photos.map((p) => ({ ...p, id: p.id ?? newDraftId() })) };
  await checkpoint(current);
  for (let i = current.photosSent ?? 0; i < current.photos.length; i++) {
    assertOwner(current.ownerKey);
    await upload("/files", { owner_type: "note", owner_id: current.noteId!, doc_kind: "photo", client_id: current.photos[i].id! }, current.photos[i]);
    current = { ...current, photosSent: i + 1 };
    await checkpoint(current);
  }
  assertOwner(current.ownerKey);
  await removeDraft(current.id);
  if (FileSystem.documentDirectory) {
    await FileSystem.deleteAsync(`${FileSystem.documentDirectory}navo-drafts/${encodeURIComponent(current.ownerKey)}/${current.id}/`, { idempotent: true }).catch(() => undefined);
  }
  return note;
}
