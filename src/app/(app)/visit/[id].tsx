import { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, upload } from "../../../lib/api";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import { useSession } from "../../../lib/session";
import { errorMessage } from "../../../lib/errors";
import { formatDate, parseDayInput, todayISO } from "../../../lib/format";
import type { ServiceVisit } from "../../../lib/api-types";
import { Banner, Body, Button, Card, ErrorBox, Loading, Pill, colors } from "../../../components/ui";
import { VisitPill } from "../../../components/Visits";

const parseDay = parseDayInput;

type Photo = { id: string; uri: string; name: string; type: string; kind: string; sent?: boolean };
type CheckItem = { kind: string; level: "required" | "optional"; present: boolean };
type VisitFiles = { checklist: CheckItem[]; kind_names: Record<string, string> };

/**
 * One visit on the phone: where to go and what to do; the technician records it (date, work
 * done, findings) and adds photos of the signed service report and the machine. The record and
 * each photo carry their own retry identity, so a weak signal never records or uploads twice.
 */
export default function VisitScreen() {
  const { t } = useT();
  const { can, me } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const visit = useApi<ServiceVisit>(`/service-visits/${id}`);
  // What the visit needs (Settings → required documents on the web), with what it already has.
  const files = useApi<VisitFiles>(`/files?owner_type=service_visit&owner_id=${id}`);
  const [form, setForm] = useState({ done_on: formatDate(todayISO()), work_done: "", findings: "" });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [key] = useState(() => Crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState(false);
  const v = visit.data;
  const mayRecord = !!v && v.status === "planned" && can("service.perform") && (can("service.plan") || v.assignee_id === me?.user.id);
  const input = { borderWidth: 1, borderColor: "#BDBDBD", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card } as const;

  const addPhoto = async (camera: boolean, kind: Photo["kind"]) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = camera ? await ImagePicker.launchCameraAsync({ quality: 0.6 }) : await ImagePicker.launchImageLibraryAsync({ quality: 0.6, mediaTypes: ["images"] });
    if (res.canceled) return;
    const a = res.assets[0];
    setPhotos((p) => [...p, { id: Crypto.randomUUID(), uri: a.uri, name: a.fileName ?? `${kind === "photo" ? "anh" : kind === "service_report" ? "bien-ban" : kind.replace(/^x_/, "")}-${p.length + 1}.jpg`, type: a.mimeType ?? "image/jpeg", kind }]);
  };

  const record = async () => {
    if (!v) return;
    const day = parseDay(form.done_on);
    if (!day || !form.work_done.trim()) { setError(t(!day ? "service.dateFormat" : "service.workRequired")); return; }
    setBusy(true); setError(null);
    try {
      if (!recorded) {
        await api(`/service-visits/${v.id}/done`, { method: "POST", idempotencyKey: key, body: { done_on: day, work_done: form.work_done.trim(), findings: form.findings.trim() || null } });
        setRecorded(true);
      }
      for (const p of photos) {
        if (p.sent) continue;
        await upload("/files", { owner_type: "service_visit", owner_id: v.id, doc_kind: p.kind, client_id: p.id }, p);
        setPhotos((list) => list.map((x) => (x.id === p.id ? { ...x, sent: true } : x)));
      }
      Alert.alert(t("service.recorded"));
      router.back();
    } catch (e) {
      setError(errorMessage(t, e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Pressable testID="visit-back" accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text accessibilityRole="header" style={{ flex: 1, fontSize: 17, fontWeight: "700", color: colors.text }}>{v?.number ?? t("service.title")}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {visit.loading && !v && <Loading />}
          {visit.error != null && !v && <ErrorBox error={visit.error} onRetry={visit.reload} />}
          {v && <>
            <Card>
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <VisitPill v={v} />
                <Pill tone="gray">{t(`service.kinds.${v.kind}`)}</Pill>
                {v.urgency === "urgent" && <Pill tone="amber">{t("service.urgent")}</Pill>}
              </View>
              <Body bold size={17}>{v.customer_name}</Body>
              {v.location && <Body>{v.location}</Body>}
              <Body muted size={13.5}>{v.contract_number} · {v.planned_on ? formatDate(v.planned_on) : t("service.noDate")}</Body>
              {v.lines.map((l) => <Body key={l.contract_line_id}>{l.name_on_contract}</Body>)}
              {v.description && <Body>{v.description}</Body>}
              {v.equipment && <Body muted size={13.5}>{[v.equipment.name, v.equipment.model, v.equipment.serial, v.equipment.location].filter(Boolean).join(" · ")}</Body>}
            </Card>
            {v.status === "done" && (
              <Card>
                <Body bold>{t("service.workDone")}</Body><Body>{v.work_done}</Body>
                {v.findings && <><Body bold>{t("service.findings")}</Body><Body>{v.findings}</Body></>}
                <Body muted size={13.5}>{formatDate(v.done_on)} · {v.done_by_name}</Body>
              </Card>
            )}
            {mayRecord && (
              <Card>
                <Body bold size={16}>{t("service.record")}</Body>
                {error && <Banner tone="red">{error}</Banner>}
                <Text nativeID="visit-done-on-label" style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("service.doneOn")}</Text>
                <TextInput testID="visit-done-on" editable={!recorded} accessibilityLabelledBy="visit-done-on-label" value={form.done_on} onChangeText={(x) => setForm({ ...form, done_on: x })} placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" style={input} />
                <Text nativeID="visit-work-label" style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("service.workDone")}</Text>
                <TextInput testID="visit-work" editable={!recorded} multiline accessibilityLabelledBy="visit-work-label" value={form.work_done} onChangeText={(x) => setForm({ ...form, work_done: x })} style={[input, { minHeight: 100, textAlignVertical: "top" }]} />
                <Text nativeID="visit-findings-label" style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("service.findings")}</Text>
                <TextInput testID="visit-findings" editable={!recorded} multiline accessibilityLabelledBy="visit-findings-label" value={form.findings} onChangeText={(x) => setForm({ ...form, findings: x })} style={[input, { minHeight: 70, textAlignVertical: "top" }]} />
                <RequiredDocs items={files.data?.checklist ?? []} names={files.data?.kind_names ?? {}} picked={photos.map((p) => p.kind)} onAdd={(kind) => void addPhoto(true, kind)} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {photos.map((p) => (
                    <View key={p.id} style={{ width: 84, gap: 2 }}>
                      <Image source={{ uri: p.uri }} accessibilityLabel={kindName(t, p.kind, files.data?.kind_names)} style={{ width: 84, height: 84, borderRadius: 8 }} />
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{kindName(t, p.kind, files.data?.kind_names)}{p.sent ? " ✓" : ""}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  <View style={{ flexGrow: 1 }}><Button testID="visit-report-photo" label={t("service.addReport")} tone="outline" onPress={() => void addPhoto(true, "service_report")} /></View>
                  <View style={{ flexGrow: 1 }}><Button testID="visit-photo" label={t("service.addPhoto")} tone="outline" onPress={() => void addPhoto(true, "photo")} /></View>
                </View>
                <Button testID="visit-library" label={t("service.fromLibrary")} tone="outline" onPress={() => void addPhoto(false, "photo")} />
                <Button testID="visit-record" label={recorded ? t("service.sendPhotos") : t("service.recordSave")} busy={busy} onPress={() => void record()} />
              </Card>
            )}
          </>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function kindName(t: ReturnType<typeof useT>["t"], kind: string, names?: Record<string, string>) {
  if (kind === "service_report") return t("service.reportPhoto");
  if (kind === "photo") return t("service.photo");
  return names?.[kind] ?? t(`docKinds.${kind}`, { defaultValue: kind });
}

/** The documents this visit needs, as on the web: ✓ when there (or taken now), otherwise tap to photograph it. */
function RequiredDocs({ items, names, picked, onAdd }: { items: CheckItem[]; names: Record<string, string>; picked: string[]; onAdd: (kind: string) => void }) {
  const { t } = useT();
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => (a.level === b.level ? 0 : a.level === "required" ? -1 : 1));
  const has = (c: CheckItem) => c.present || picked.includes(c.kind);
  const missing = sorted.filter((c) => c.level === "required" && !has(c)).length;
  return (
    <View style={{ gap: 6, backgroundColor: colors.background, borderRadius: 10, padding: 10 }}>
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: colors.text }}>
        {t("docField.needed")} · <Text style={{ color: missing > 0 ? colors.danger : colors.success }}>{missing > 0 ? t("docField.missingPill", { count: missing }) : t("docField.complete")}</Text>
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {sorted.map((c) => {
          const ok = has(c);
          const name = names[c.kind] ?? t(`docKinds.${c.kind}`, { defaultValue: c.kind });
          const level = t(c.level === "required" ? "docField.levelRequired" : "docField.levelOptional");
          const tone = ok ? [colors.successLight, colors.success] : c.level === "required" ? [colors.dangerLight, colors.danger] : [colors.divider, colors.textSecondary];
          return (
            <Pressable key={c.kind} testID={`visit-need-${c.kind}`} disabled={ok} onPress={() => onAdd(c.kind)} accessibilityRole="button"
              accessibilityLabel={ok ? `${name} ✓` : t("docField.addAs", { kind: name })}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: tone[0] }}>
              <Ionicons name={ok ? "checkmark" : "camera-outline"} size={14} color={tone[1]} />
              <Text style={{ color: tone[1], fontWeight: "700", fontSize: 13 }}>{name} <Text style={{ fontWeight: "400" }}>· {level}</Text></Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
