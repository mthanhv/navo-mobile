import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { api, upload, type LocalFile } from "./api";
import type { Note } from "./types";

/**
 * Field notes are saved on the phone first (sóng yếu ở nhà máy), then sent. The draft's id is
 * the note's client_id, so sending the same draft twice stores it once on the server.
 */
export type Draft = {
  id: string;
  customerId: string;
  customerName: string;
  contractId: string | null;
  contractNumber: string | null;
  body: string;
  taskTitle: string;
  taskDue: string; // YYYY-MM-DD or ""
  photos: LocalFile[];
  writtenAt: string;
  noteId?: string; // set once the note is stored, while photos are still uploading
  photosSent?: number;
};

const KEY = "navo.noteDrafts";

export const newDraftId = () => Crypto.randomUUID();

export async function listDrafts(): Promise<Draft[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Draft[]) : [];
  } catch {
    return [];
  }
}

async function write(drafts: Draft[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(drafts));
}

export async function saveDraft(d: Draft) {
  const all = (await listDrafts()).filter((x) => x.id !== d.id);
  await write([...all, d]);
}

export async function removeDraft(id: string) {
  await write((await listDrafts()).filter((x) => x.id !== id));
}

/** Sends one draft: the note (with its task), then each photo; removes it when all is stored. */
export async function sendDraft(d: Draft): Promise<Note> {
  let current = d;
  let note: Note;
  if (!current.noteId) {
    note = await api<Note>("/notes", {
      method: "POST",
      body: {
        client_id: d.id, customer_id: d.customerId, contract_id: d.contractId, body: d.body, written_at: d.writtenAt,
        task: d.taskTitle.trim() ? { title: d.taskTitle.trim(), due_on: d.taskDue || null } : undefined,
      },
    });
    current = { ...current, noteId: note.id, photosSent: 0 };
    await saveDraft(current);
  } else {
    note = { id: current.noteId } as Note;
  }
  for (let i = current.photosSent ?? 0; i < current.photos.length; i++) {
    await upload("/files", { owner_type: "note", owner_id: current.noteId!, doc_kind: "photo" }, current.photos[i]);
    current = { ...current, photosSent: i + 1 };
    await saveDraft(current);
  }
  await removeDraft(d.id);
  return note;
}
