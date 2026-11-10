/// <reference types="jest" />
import { api, upload } from "./api";
import { draftOwner, listDrafts, retainPhoto, saveDraft, sendDraft, setDraftOwner, type Draft } from "./drafts";
const mockStore = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: {
  getItem: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
} }));
let mockID = 0;
jest.mock("expo-crypto", () => ({ randomUUID: () => `photo-${++mockID}` }));
jest.mock("expo-file-system/legacy", () => ({ documentDirectory: "file:///documents/", makeDirectoryAsync: jest.fn(async () => undefined), copyAsync: jest.fn(async () => undefined), deleteAsync: jest.fn(async () => undefined) }));
jest.mock("./api", () => ({ API_URL: "https://example.test/api/v1", api: jest.fn(), upload: jest.fn() }));
const mockAPI = api as jest.Mock;
const mockUpload = upload as jest.Mock;
const draft = (id = "draft-1"): Draft => ({ id, ownerKey: draftOwner(), customerId: "customer", customerName: "Customer", contractId: null, contractNumber: null, body: "Discussed delivery", taskTitle: "Call", taskDue: "2026-11-12", photos: [{ uri: "file:///saved/photo.jpg", name: "photo.jpg", type: "image/jpeg" }], writtenAt: "2026-11-10T10:00:00Z" });
beforeEach(() => { mockStore.clear(); jest.clearAllMocks(); setDraftOwner("sales-a"); mockAPI.mockResolvedValue({ id: "note-1" }); mockUpload.mockResolvedValue({ id: "file-1" }); });
afterEach(() => { setDraftOwner(null); });

test("accounts cannot list or write each other's drafts; legacy unowned data stays unclaimed", async () => {
  const a = draft(); await saveDraft(a);
  mockStore.set("navo.noteDrafts", JSON.stringify([a]));
  setDraftOwner("sales-b"); expect(await listDrafts()).toEqual([]);
  await expect(saveDraft(a)).rejects.toThrow("another account");
  setDraftOwner(null); expect(await listDrafts()).toEqual([]);
  setDraftOwner("sales-a"); expect((await listDrafts())[0].id).toBe(a.id);
});
test("concurrent local saves preserve different drafts", async () => {
  await Promise.all([saveDraft(draft("one")), saveDraft(draft("two"))]);
  expect((await listDrafts()).map((d) => d.id).sort()).toEqual(["one", "two"]);
});
test("a lost photo response retries the same upload identity and preserves the successful note checkpoint", async () => {
  const d = draft(); await saveDraft(d);
  mockUpload.mockRejectedValueOnce(new Error("response lost"));
  await expect(sendDraft(d)).rejects.toThrow("response lost");
  const pending = (await listDrafts())[0]; expect(pending.noteId).toBe("note-1"); expect(pending.photosSent).toBe(0);
  await saveDraft({ ...d, body: "stale screen value" });
  expect((await listDrafts())[0].body).toBe(d.body);
  await sendDraft(d);
  expect(mockAPI).toHaveBeenCalledTimes(1);
  expect(mockUpload.mock.calls[0][1].client_id).toBe(mockUpload.mock.calls[1][1].client_id);
  expect(await listDrafts()).toEqual([]);
});
test("double send shares one operation", async () => {
  const d = draft(); await saveDraft(d);
  let release!: (value: { id: string }) => void;
  mockAPI.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
  const first = sendDraft(d), second = sendDraft(d); expect(first).toBe(second);
  await new Promise((resolve) => setTimeout(resolve, 0)); release({ id: "note-1" });
  await Promise.all([first, second]); expect(mockAPI).toHaveBeenCalledTimes(1); expect(mockUpload).toHaveBeenCalledTimes(1);
});
test("selected camera assets are copied out of temporary storage", async () => {
  const d = draft(); const photo = await retainPhoto(d, d.photos[0]);
  expect(photo.uri).toContain("file:///documents/navo-drafts/"); expect(photo.id).toBeTruthy(); expect(photo.uri).not.toBe(d.photos[0].uri);
});
