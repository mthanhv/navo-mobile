import { useCallback, useMemo, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { api, type Page } from "../../lib/api";
import { useT } from "../../lib/i18n";
import { useApi } from "../../lib/useApi";
import { errorMessage } from "../../lib/errors";
import { formatDate } from "../../lib/format";
import type { Organization } from "../../lib/types";
import { BackHeader, Banner, Body, Button, Card, DataFreshness, Field, Loading, Pill, Screen, Title, colors, type Tone } from "../../components/ui";

type Line = {
  id: string; section: "done" | "plan"; day: string; organization_name: string | null; contact_name: string | null; mobile: string | null; work: string;
  time_slot: "morning" | "afternoon" | "all_day" | null; location: string | null; online: boolean; note: string | null; outcome?: string; moved_to?: string; manager_comment: string | null;
};
type Report = {
  id: string; label: string; week_start: string; week_end: string; next_start: string; status: "draft" | "submitted" | "reviewed"; late: boolean; due_at: string;
  review_note: string | null; reviewed_by_name: string | null; done: Line[]; plan: Line[]; last_plan: Line[]; can_edit: boolean;
};

const SLOTS = ["morning", "afternoon", "all_day"] as const;
/** "Đạm Phương Nam" matches "dam phuong": lower case, no accents, đ as d. */
const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
const outcomeTone: Record<string, Tone> = { done: "green", moved: "amber", not_done: "red", removed: "gray" };
const days = (start: string) => Array.from({ length: 6 }, (_, i) => { const d = new Date(`${start}T00:00:00`); d.setDate(d.getDate() + i);
  const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; });

/**
 * Tuần này: the weekly report on the phone — what was planned and what came of it, what was done
 * (filled from visits and calls logged on the phone), next week's plan, and adding to it in a few
 * taps. Typing by voice uses the keyboard's microphone. The full sheet is edited on the web.
 */
export default function WeekScreen() {
  const { t } = useT();
  const r = useApi<Report>("/weekly-reports/mine");
  const reload = r.reload;
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const d = r.data;
  const submit = async () => {
    if (!d) return;
    setBusy(true); setError(null);
    try { await api(`/weekly-reports/${d.id}/submit`, { method: "POST" }); reload(); } catch (e) { setError(errorMessage(t, e)); } finally { setBusy(false); }
  };
  const dayLabel = (iso: string) => `${t(`weekly.weekday.${new Date(`${iso}T00:00:00`).getDay()}`)} ${formatDate(iso).slice(0, 5)}`;
  const row = (l: Line) => (
    <Card key={l.id}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Text style={{ fontSize: 13.5, fontWeight: "700", color: colors.primary, minWidth: 78 }}>{dayLabel(l.day)}</Text>
        <View style={{ flex: 1 }}><Body bold>{l.organization_name ?? t("weekly.noCustomer")}</Body></View>
        {l.outcome && <Pill tone={outcomeTone[l.outcome]}>{t(`weekly.outcome.${l.outcome}`, { date: formatDate(l.moved_to) })}</Pill>}
      </View>
      {!!l.work && <Body>{l.work}</Body>}
      {(l.time_slot || l.location || l.online) && <Body muted size={13}>{[l.time_slot && t(`weekly.slot.${l.time_slot}`), l.online ? t("weekly.online") : l.location].filter(Boolean).join(" · ")}</Body>}
      {(l.contact_name || l.mobile) && <Body muted size={13}>{[l.contact_name, l.mobile].filter(Boolean).join(" · ")}</Body>}
      {!!l.note && <Body size={13.5}>💡 {l.note}</Body>}
      {!!l.manager_comment && <Text style={{ fontSize: 13.5, color: colors.warning }}>💬 {l.manager_comment}</Text>}
    </Card>
  );
  return (
    <Screen header={<BackHeader title={t("weekly.title")} backLabel={t("common.close")} onBack={() => router.back()} />} refreshing={r.refreshing} onRefresh={reload}>
      <DataFreshness data={r.data} error={r.error} fetchedAt={r.fetchedAt} offline={r.offline} onRetry={reload} />
      {r.loading && !d && <Loading />}
      {d && <>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1 }}><Body bold size={17}>{d.label}</Body><Body muted size={13}>{formatDate(d.week_start)} – {formatDate(d.week_end)}</Body></View>
            <Pill tone={d.late ? "red" : d.status === "reviewed" ? "green" : d.status === "submitted" ? "blue" : "gray"}>{d.late ? t("weekly.lateStatus") : t(`weekly.status.${d.status}`)}</Pill>
          </View>
          {!!d.review_note && <Text style={{ fontSize: 14, color: colors.warning }}>💬 {d.reviewed_by_name}: {d.review_note}</Text>}
        </Card>
        {error && <Banner tone="red">{error}</Banner>}
        {d.last_plan.length > 0 && <><Title>{t("weekly.lastPlan")}</Title>{d.last_plan.map(row)}</>}
        <Title>{t("weekly.doneTitle")}</Title>
        {d.done.length === 0 ? <Card><Body muted>{t("weekly.doneEmptyPhone")}</Body></Card> : d.done.map(row)}
        <Title>{t("weekly.planTitle")}</Title>
        {d.plan.map(row)}
        {d.can_edit && (adding
          ? <AddPlan report={d} onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload(); }} />
          : <Button testID="week-add-plan" label={t("weekly.addPlan")} tone="outline" onPress={() => setAdding(true)} />)}
        {d.can_edit && d.status === "draft" && <Button testID="week-submit" label={t("weekly.submit")} busy={busy} onPress={() => void submit()} />}
        <Body muted size={12.5}>{t("weekly.phoneHint")}</Body>
      </>}
    </Screen>
  );
}

function AddPlan({ report, onClose, onDone }: { report: Report; onClose: () => void; onDone: () => void }) {
  const { t } = useT();
  const choices = useMemo(() => days(report.next_start), [report.next_start]);
  const [day, setDay] = useState(choices[0]);
  const [work, setWork] = useState("");
  const [slot, setSlot] = useState<(typeof SLOTS)[number] | null>(null);
  const [online, setOnline] = useState(false);
  const [place, setPlace] = useState("");
  const [query, setQuery] = useState("");
  const [org, setOrg] = useState<Organization | null>(null);
  const orgs = useApi<Page<Organization>>(`/organizations?role=prospect&page_size=100${query.trim().length > 1 ? `&q=${encodeURIComponent(query.trim())}` : ""}`);
  const matches = query.trim() ? (orgs.data?.items ?? []).filter((o) => fold(`${o.name} ${o.code ?? ""}`).includes(fold(query.trim()))).slice(0, 5) : [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (!work.trim() && !org) { setError(t("weekly.needWork")); return; }
    setBusy(true); setError(null);
    try {
      await api(`/weekly-reports/${report.id}/lines`, { method: "POST", body: { section: "plan", day, organization_id: org?.id ?? null, work: work.trim(), time_slot: slot,
        location: place.trim() || null, online } });
      onDone();
    } catch (e) { setError(errorMessage(t, e)); setBusy(false); }
  };
  const chip = (key: string, label: string, on: boolean, press: () => void) => (
    <Pressable key={key} testID={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={press}
      style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5, borderColor: on ? colors.primary : colors.divider, backgroundColor: on ? colors.primaryLight : colors.card }}>
      <Text style={{ fontSize: 13.5, fontWeight: "600", color: on ? colors.primary : colors.text }}>{label}</Text>
    </Pressable>
  );
  return (
    <Card>
      <Body bold>{t("weekly.addPlan")}</Body>
      {error && <Banner tone="red">{error}</Banner>}
      <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{t("weekly.day")}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {choices.map((x) => chip(`week-day-${x}`, `${t(`weekly.weekday.${new Date(`${x}T00:00:00`).getDay()}`)} ${formatDate(x).slice(0, 5)}`, day === x, () => setDay(x)))}
      </View>
      {org ? (
        <Pressable testID="week-org-clear" accessibilityRole="button" onPress={() => setOrg(null)} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Body bold>{org.name}</Body><Text style={{ color: colors.primary, fontWeight: "600" }}>{t("weekly.change")}</Text>
        </Pressable>
      ) : (
        <>
          <Field id="week-org" label={t("weekly.customer")} value={query} onChangeText={setQuery} placeholder={t("weekly.customerHint")} />
          {matches.map((o) => (
            <Pressable key={o.id} testID={`week-org-${o.code ?? o.id}`} accessibilityRole="button" onPress={() => { setOrg(o); setQuery(""); }} style={{ minHeight: 40, justifyContent: "center", paddingLeft: 6 }}>
              <Body>{o.name}</Body>
            </Pressable>
          ))}
        </>
      )}
      <Field id="week-work" label={t("weekly.work")} value={work} onChangeText={setWork} multiline placeholder={t("weekly.workHint")} hint={t("weekly.voiceHint")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {SLOTS.map((x) => chip(`week-slot-${x}`, t(`weekly.slot.${x}`), slot === x, () => setSlot(slot === x ? null : x)))}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Switch testID="week-online" value={online} onValueChange={setOnline} accessibilityLabel={t("weekly.online")} />
        <Body>{t("weekly.online")}</Body>
      </View>
      {!online && <Field id="week-place" label={t("weekly.place")} value={place} onChangeText={setPlace} placeholder={t("weekly.placeHint")} />}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}><Button label={t("common.cancel")} tone="outline" onPress={onClose} /></View>
        <View style={{ flex: 1 }}><Button testID="week-plan-save" label={t("common.save")} busy={busy} onPress={() => void save()} /></View>
      </View>
    </Card>
  );
}
