import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, allPages } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import { draftOwner, listDrafts, newDraftId, retainPhoto, saveDraft, sendDraft, type Draft } from "../../lib/drafts";
import type { Contract, Organization } from "../../lib/types";
import { Body, Button, Card, colors } from "../../components/ui";

/** dd/mm/yyyy (or yyyy-mm-dd) typed by a person → yyyy-mm-dd, or null. */
function parseDay(s: string): string | null {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

/** Ghi nhanh (mockup MQuickNote): who, what was said, photos, the next step — saved on the phone first. */
export default function QuickNoteScreen() {
  const { t } = useT();
  const params = useLocalSearchParams<{ customer?: string; contract?: string; draft?: string }>();
  const [draft, setDraft] = useState<Draft>(() => ({
    id: newDraftId(), ownerKey: draftOwner(), customerId: params.customer ?? "", customerName: "", contractId: params.contract ?? null, contractNumber: null,
    body: "", taskTitle: "", taskDue: "", photos: [], writtenAt: new Date().toISOString(),
  }));
  const [due, setDue] = useState("");
  const [customers, setCustomers] = useState<Organization[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [picking, setPicking] = useState<"customer" | "contract" | null>(null);
  const [banner, setBanner] = useState<"saved" | "offline" | "sent" | null>(null);
  const [busy, setBusy] = useState(false);
  const [aiOn, setAiOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<TextInput>(null);
  const [restored, setRestored] = useState(!params.draft);
  const sent = useRef(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => d.noteId ? d : ({ ...d, ...patch }));
  // Autosave unvalidated work too: validation belongs to Send, not persistence.
  useEffect(() => {
    if (!restored || sent.current || busy || (!draft.body && !draft.photos.length && !draft.taskTitle)) return;
    const timer = setTimeout(() => { void saveDraft({ ...draft, taskDue: parseDay(due) ?? due }).catch((e) => setError(errorMessage(t, e))); }, 400);
    return () => clearTimeout(timer);
  }, [draft, due, restored, busy, t]);
  const latestWork = useRef({ draft, due, restored });
  useEffect(() => { latestWork.current = { draft, due, restored }; }, [draft, due, restored]);
  useEffect(() => {
    const persist = () => {
      const work = latestWork.current;
      if (work.restored && !sent.current && (work.draft.body || work.draft.photos.length || work.draft.taskTitle)) {
        void saveDraft({ ...work.draft, taskDue: parseDay(work.due) ?? work.due }).catch(() => undefined);
      }
    };
    const subscription = AppState.addEventListener("change", (state) => { if (state !== "active") persist(); });
    return () => { subscription.remove(); persist(); };
  }, []);
  const close = async () => {
    if (!sent.current && (draft.body || draft.photos.length || draft.taskTitle)) {
      try { await saveDraft({ ...draft, taskDue: parseDay(due) ?? due }); } catch (e) { setError(errorMessage(t, e)); return; }
    }
    router.back();
  };

  useEffect(() => {
    void (async () => {
      if (params.draft) {
        const d = (await listDrafts()).find((x) => x.id === params.draft);
        if (d) { setDraft(d); setDue(d.taskDue ? formatDate(d.taskDue) : ""); setBanner("saved"); }
        setRestored(true);
      }
      try {
        const [cs, ks, ai] = await Promise.all([
          allPages<Organization>("/organizations?role=customer"),
          allPages<Contract>("/contracts?tab=all"),
          api<{ enabled: boolean }>("/ai/status"),
        ]);
        setCustomers(cs);
        setContracts(ks);
        setAiOn(ai.enabled);
        setDraft((d) => {
          const k = ks.find((x) => x.id === d.contractId);
          const custId = d.customerId || k?.customer_id || "";
          return { ...d, customerId: custId, customerName: cs.find((c) => c.id === custId)?.name ?? d.customerName, contractNumber: k?.number ?? d.contractNumber };
        });
      } catch {
        // Offline: the note can still be written and saved on the phone.
      }
    })();
  }, [params.draft]);

  const contractChoices = useMemo(() => contracts.filter((k) => !draft.customerId || k.customer_id === draft.customerId), [contracts, draft.customerId]);

  const addPhoto = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = camera ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (res.canceled) return;
    const a = res.assets[0];
    try {
      const photo = await retainPhoto(draft, { uri: a.uri, name: a.fileName ?? `anh-${draft.photos.length + 1}.jpg`, type: a.mimeType ?? "image/jpeg" });
      set({ photos: [...draft.photos, photo] });
    } catch (e) { setError(errorMessage(t, e)); }
  };

  const readWithAI = async () => {
    if (!draft.body.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ body: string; task_title: string | null; due_on: string | null }>("/ai/note-parse", { method: "POST", body: { text: draft.body } });
      set({ body: r.body, taskTitle: r.task_title ?? draft.taskTitle });
      if (r.due_on) setDue(formatDate(r.due_on));
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  const complete = (): Draft | null => {
    setError(null);
    if (!draft.customerId) { setError(t("note.needCustomer")); return null; }
    if (!draft.body.trim()) { setError(t("note.needBody")); return null; }
    const d = due.trim() ? parseDay(due) : "";
    if (d === null) { setError(t("note.badDate")); return null; }
    if (d && !draft.taskTitle.trim()) { setError(t("note.needTask")); return null; }
    return { ...draft, taskDue: d ?? "" };
  };

  const saveLocal = async () => {
    const d = complete();
    if (!d) return;
    try { await saveDraft(d); setDraft(d); setBanner("saved"); }
    catch (e) { setError(errorMessage(t, e)); }
  };

  const send = async () => {
    const d = complete();
    if (!d) return;
    if (busy) return;
    setBusy(true);
    try {
      await saveDraft(d); // safe on the phone before anything else
      setDraft(d);
      const net = await NetInfo.fetch();
      if (net.isConnected === false) { setBanner("offline"); return; }
      await sendDraft(d);
      sent.current = true;
      setBanner("sent");
      setTimeout(() => router.back(), 900);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      if (code.startsWith("network.")) setBanner("offline");
      else setError(errorMessage(t, e));
      const current = (await listDrafts()).find((x) => x.id === d.id);
      if (current) setDraft(current);
    } finally {
      setBusy(false);
    }
  };

  const input = { borderWidth: 1, borderColor: "#BDBDBD", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card } as const;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => void close()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{t("note.title")}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {banner && (
            <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 12, gap: 8, backgroundColor: banner === "sent" ? "#E8F5E9" : "#FFF4E0" }}>
              <Body bold>{t(`note.banner.${banner}.title`)}</Body>
              <Body size={14}>{t(`note.banner.${banner}.text`)}</Body>
              {banner !== "sent" && <Button label={t("note.sendNow")} tone="outline" onPress={() => void send()} busy={busy} testID="note-send-now" />}
            </View>
          )}
          {error && <View accessibilityRole="alert" style={{ padding: 12, borderRadius: 10, backgroundColor: "#FDECEA" }}><Text style={{ color: "#8E1C1C", fontSize: 14.5 }}>{error}</Text></View>}

          <Card>
            <Body muted size={13}>{t("note.prefilled")}</Body>
            {([["customer", t("note.customer"), draft.customerName || t("note.choose")], ["contract", t("note.contract"), draft.contractNumber ?? t("note.noContract")]] as const).map(([key, label, value]) => (
              <Pressable key={key} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={() => setPicking(picking === key ? null : key)}
                style={{ flexDirection: "row", alignItems: "center", minHeight: 44, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <Body muted size={14}>{label}</Body>
                <Text style={{ flex: 1, textAlign: "right", fontSize: 15, fontWeight: "600", color: colors.text }} numberOfLines={1}>{value}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {picking === "customer" && customers.map((c) => (
              <Pressable key={c.id} onPress={() => { set({ customerId: c.id, customerName: c.name, contractId: null, contractNumber: null }); setPicking(null); }} style={{ minHeight: 44, justifyContent: "center", paddingLeft: 8 }}>
                <Body>{c.name}</Body>
              </Pressable>
            ))}
            {picking === "contract" && [{ id: "", number: t("note.noContract"), title: "" }, ...contractChoices.map((k) => ({ id: k.id, number: k.number ?? k.draft_number, title: k.title }))].map((k) => (
              <Pressable key={k.id || "none"} onPress={() => { set({ contractId: k.id || null, contractNumber: k.id ? k.number : null }); setPicking(null); }} style={{ minHeight: 44, justifyContent: "center", paddingLeft: 8 }}>
                <Body>{k.number}{k.title ? ` · ${k.title}` : ""}</Body>
              </Pressable>
            ))}
          </Card>

          <View style={{ gap: 6 }}>
            <Text nativeID="note-body-label" style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{t("note.body")}</Text>
            <TextInput ref={bodyRef} testID="note-body" accessibilityLabelledBy="note-body-label" editable={!draft.noteId} multiline value={draft.body} onChangeText={(v) => set({ body: v })}
              placeholder={t("note.bodyPlaceholder")} style={[input, { minHeight: 130, textAlignVertical: "top" }]} />
          </View>

          <Card style={{ backgroundColor: colors.primaryLight }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="mic" size={22} color={colors.primary} />
              <Body bold>{t("note.voice")}</Body>
            </View>
            <Body size={14}>{t("note.voiceHint")}</Body>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              <Button label={t("note.speak")} tone="outline" onPress={() => bodyRef.current?.focus()} testID="note-speak" />
              {aiOn && <Button label={t("note.readWithAI")} tone="outline" onPress={() => void readWithAI()} busy={busy} testID="note-ai" />}
            </View>
          </Card>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>{t("note.photos", { count: draft.photos.length })}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {draft.photos.map((p, i) => (
                <Pressable key={p.uri} accessibilityRole="button" accessibilityLabel={t("note.removePhoto", { n: i + 1 })} onLongPress={() => set({ photos: draft.photos.filter((_, j) => j !== i) })}>
                  <Image source={{ uri: p.uri }} accessibilityLabel={t("note.photo", { n: i + 1 })} style={{ width: 76, height: 76, borderRadius: 10 }} />
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" accessibilityLabel={t("note.addPhoto")} testID="note-add-photo"
                onPress={() => Alert.alert(t("note.addPhoto"), undefined, [{ text: t("note.camera"), onPress: () => void addPhoto(true) }, { text: t("note.library"), onPress: () => void addPhoto(false) }, { text: t("common.cancel"), style: "cancel" }])}
                style={{ width: 76, height: 76, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="camera-outline" size={24} color={colors.muted} />
                <Text style={{ fontSize: 11.5, color: colors.muted }}>{t("note.addPhoto")}</Text>
              </Pressable>
            </View>
          </View>

          <Card>
            <Body bold>{t("note.next")}</Body>
            <Text nativeID="note-task-label" style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("note.taskTitle")}</Text>
            <TextInput testID="note-task" editable={!draft.noteId} accessibilityLabelledBy="note-task-label" value={draft.taskTitle} onChangeText={(v) => set({ taskTitle: v })} style={input} />
            <Text nativeID="note-due-label" style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("note.remind")}</Text>
            <TextInput testID="note-due" editable={!draft.noteId} accessibilityLabelledBy="note-due-label" value={due} onChangeText={setDue} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" style={input} />
          </Card>
        </ScrollView>
        <View style={{ flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.card }}>
          <View style={{ flex: 1 }}><Button label={t("note.saveDraft")} tone="outline" onPress={() => void saveLocal()} testID="note-save" /></View>
          <View style={{ flex: 1 }}><Button label={t("note.send")} onPress={() => void send()} busy={busy} testID="note-send" /></View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
