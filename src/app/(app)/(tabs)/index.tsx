import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import { api, type Page } from "../../../lib/api";
import { useSession } from "../../../lib/session";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import { formatDate, formatDecimal, todayISO } from "../../../lib/format";
import { listDrafts, sendDraft, type Draft } from "../../../lib/drafts";
import type { LineRow, Overview, POSummary, Task } from "../../../lib/types";
import { Body, Button, Card, DataFreshness, ErrorBox, Loading, Pill, Screen, Title, colors } from "../../../components/ui";

const ACTION = ["delivery_overdue", "over_delivered", "stock_short", "no_plan", "receipt_overdue", "over_ordered"];

/** Home: Sales see "Hôm nay" (tasks, deliveries, goods arriving); leaders the company overview (mockups MSalesToday / MLeader). */
export default function HomeScreen() {
  const { t } = useT();
  const { me, can } = useSession();
  const first = me?.user.full_name.split(" ").pop() ?? "";
  if (!can("contracts.read")) {
    return (
      <Screen header={<Hero top={t("mobile.hello", { name: first })} title={t("mobile.tabs.overview")} />}>
        <Card><Body muted>{t("mobile.webOnly")}</Body></Card>
      </Screen>
    );
  }
  const wide = !!me?.user.roles.some((r) => r === "leader" || r === "accounting" || r === "admin");
  return wide ? <LeaderHome first={first} /> : <SalesToday />;
}

function Hero({ top, title, sub, bell }: { top: string; title: string; sub?: string; bell?: number }) {
  const { t } = useT();
  return (
    <View style={{ backgroundColor: colors.hero, padding: 20, paddingTop: 12, gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: "#B9D1F5", fontSize: 14 }}>{top}</Text>
          <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{title}</Text>
        </View>
        {bell !== undefined && (
          <View accessible accessibilityLabel={t("mobile.bell", { count: bell })} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            {bell > 0 && (
              <View style={{ position: "absolute", top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>{bell}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      {sub && <Text style={{ color: "#B9D1F5", fontSize: 13.5 }}>{sub}</Text>}
    </View>
  );
}

function shortDetail(t: ReturnType<typeof useT>["t"], lang: "vi" | "en", r: LineRow, code: string) {
  const p = r.flags.find((f) => f.code === code)?.params ?? {};
  const n = (v?: string) => formatDecimal(v ?? "0", lang);
  return t(`mobile.attn.${code}`, { remaining: n(p.remaining ?? r.remaining), unit: r.unit, days: p.days_late ?? "", needed: n(p.needed), available: n(p.available ?? r.available), over: n(p.over) });
}

function LeaderHome({ first }: { first: string }) {
  const { t, lang } = useT();
  const { data, fetchedAt, error, loading, refreshing, offline, reload } = useApi<Overview>("/reports/overview");
  const time = fetchedAt ? fetchedAt.toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  const attention = (data?.attention ?? []).flatMap((r) => {
    const f = r.flags.find((x) => ACTION.includes(x.code));
    return f ? [{ r, code: f.code, sev: f.severity }] : [];
  });
  const overdueContracts = new Set(attention.filter((a) => a.code === "delivery_overdue").map((a) => a.r.contract_id)).size;
  const firm = data?.upcoming.filter((u) => u.firmness === "firm").length ?? 0;
  const kpis = data ? [
    { title: t("mobile.kpi.overdue"), value: data.flag_counts.delivery_overdue ?? 0, sub: t("mobile.kpi.inContracts", { count: overdueContracts }), color: colors.danger },
    { title: t("mobile.kpi.noPlan"), value: data.flag_counts.no_plan ?? 0, sub: t("mobile.kpi.toDeliver"), color: "#B45309" },
    { title: t("mobile.kpi.deliveries"), value: data.upcoming.length, sub: t("mobile.kpi.firmTentative", { firm, tentative: data.upcoming.length - firm }), color: colors.text },
    { title: t("mobile.kpi.poWaiting"), value: data.purchase_orders_awaiting_goods, sub: t("mobile.kpi.lateLines", { count: data.flag_counts.receipt_overdue ?? 0 }), color: colors.text },
  ] : [];
  return (
    <Screen refreshing={refreshing} onRefresh={reload}
      header={<Hero top={t("mobile.hello", { name: first })} title={t("mobile.tabs.overview")} bell={attention.length} sub={`${t("mobile.wholeCompany")} · ${time ? t("common.asOf", { time }) : t("mobile.pullHint")}`} />}>
      <DataFreshness data={data} error={error} fetchedAt={fetchedAt} offline={offline} onRetry={reload} />
      {offline && <Button label={t("common.retry")} tone="outline" onPress={reload} />}
      {loading && !data && <Loading />}
      {error != null && !data && <ErrorBox error={error} onRetry={reload} />}
      {data && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {kpis.map((k) => (
              <Card key={k.title} style={{ flexBasis: "47%", flexGrow: 1 }}>
                <Body muted size={13}>{k.title}</Body>
                <Text style={{ fontSize: 28, fontWeight: "800", color: k.color }}>{formatDecimal(String(k.value), lang)}</Text>
                <Body muted size={12.5}>{k.sub}</Body>
              </Card>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}><Title>{t("overview.needsAction")}</Title></View>
            <Pressable accessibilityRole="link" onPress={() => router.push("/(app)/(tabs)/contracts")} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 14.5 }}>{t("mobile.seeAll")}</Text>
            </Pressable>
          </View>
          {attention.length === 0 && <Card><Body muted>{t("overview.introClear")}</Body></Card>}
          {attention.slice(0, 6).map(({ r, code, sev }) => (
            <Pressable key={r.contract_line_id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${r.contract_id}`)}>
              <Card>
                <Text style={{ fontSize: 13.5, fontWeight: "800", color: sev === "critical" ? colors.danger : "#8A4B00" }}>⚠ {t(`flags.${code}`)}</Text>
                <Body bold size={16}>{r.name_on_contract}</Body>
                <Body size={15}>{shortDetail(t, lang, r, code)}</Body>
                <Body muted size={13}>{r.contract_number} · {r.customer_name} · {r.owner_name}</Body>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}

function plusDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function SalesToday() {
  const { t, lang } = useT();
  const overview = useApi<Overview>("/reports/overview");
  const tasks = useApi<Task[]>("/tasks");
  const pos = useApi<Page<POSummary>>("/purchase-orders?view=awaiting&page_size=50");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [sending, setSending] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);
  const reloadTasks = tasks.reload;
  useFocusEffect(useCallback(() => {
    void listDrafts().then(setDrafts);
    reloadTasks();
  }, [reloadTasks]));
  const reload = () => { overview.reload(); tasks.reload(); pos.reload(); void listDrafts().then(setDrafts); };
  const today = todayISO();
  const weekEnd = plusDays(today, 7);
  const arriving = (pos.data?.items ?? []).filter((p) => p.next_expected_on && p.next_expected_on <= weekEnd);
  const open = (tasks.data ?? []).filter((x) => !x.done_at).length;
  const toggle = async (task: Task) => {
    setChanging(task.id);
    try {
      await api(`/tasks/${task.id}/${task.done_at ? "reopen" : "done"}`, { method: "POST" });
      tasks.reload();
    } finally {
      setChanging(null);
    }
  };
  const sendAll = async () => {
    const net = await NetInfo.fetch();
    if (net.isConnected === false) return;
    setSending(true);
    for (const d of drafts) await sendDraft(d).catch(() => undefined);
    setDrafts(await listDrafts());
    setSending(false);
    tasks.reload();
  };
  const dateLabel = `${t(`mobile.weekdayLong.${new Date(`${today}T00:00:00`).getDay()}`)}, ${formatDate(today)}`;
  return (
    <View style={{ flex: 1 }}>
      <Screen refreshing={overview.refreshing} onRefresh={reload} header={<Hero top={dateLabel} title={t("mobile.today")} bell={overview.data?.needs_action ?? 0} />}>
        <DataFreshness {...overview} onRetry={reload} />
        <DataFreshness {...tasks} onRetry={tasks.reload} />
        <DataFreshness {...pos} onRetry={pos.reload} />
        {drafts.length > 0 && (
          <Card style={{ backgroundColor: "#FFF4E0" }}>
            <Body bold>{t("mobile.unsent", { count: drafts.length })}</Body>
            <Body muted size={13.5}>{drafts[0].customerName} · {new Date(drafts[0].writtenAt).toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</Body>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}><Button label={t("mobile.open")} tone="outline" onPress={() => router.push({ pathname: "/(app)/note", params: { draft: drafts[0].id } })} /></View>
              <View style={{ flex: 1 }}><Button label={t("note.sendNow")} onPress={() => void sendAll()} busy={sending} testID="drafts-send" /></View>
            </View>
          </Card>
        )}
        <Title>{t("mobile.tasks", { count: open })}</Title>
        {tasks.loading && !tasks.data && <Loading />}
        {tasks.data?.length === 0 && <Card><Body muted>{t("mobile.noTasks")}</Body></Card>}
        {tasks.data?.map((task) => {
          const done = !!task.done_at;
          const late = !done && !!task.due_on && task.due_on < today;
          return (
            <Pressable key={task.id} accessibilityRole="checkbox" accessibilityState={{ checked: done, busy: changing === task.id }} accessibilityLabel={t("mobile.markDone", { text: task.title })} onPress={() => void toggle(task)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 26, height: 26, borderRadius: 7, borderWidth: 2, borderColor: done ? "#15803D" : "#94A0B2", backgroundColor: done ? "#15803D" : "#fff", alignItems: "center", justifyContent: "center" }}>
                  {done && <Ionicons name="checkmark" size={18} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: done ? colors.muted : colors.text, textDecorationLine: done ? "line-through" : "none" }}>{task.title}</Text>
                  <Text style={{ fontSize: 13.5, color: done ? "#15803D" : late ? colors.danger : colors.muted }}>
                    {done ? t("mobile.done") : [task.due_on ? (late ? t("mobile.lateSince", { date: formatDate(task.due_on) }) : formatDate(task.due_on)) : "", task.customer_name ?? ""].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </Card>
            </Pressable>
          );
        })}
        <Title>{t("mobile.deliveriesWeek")}</Title>
        {overview.loading && !overview.data && <Loading />}
        {overview.error != null && !overview.data && <ErrorBox error={overview.error} onRetry={reload} />}
        {overview.data?.upcoming.length === 0 && <Card><Body muted>{t("overview.noUpcoming")}</Body></Card>}
        {overview.data?.upcoming.map((u) => (
          <Pressable key={u.id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${u.contract_id}`)}>
            <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 52, alignItems: "center" }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: colors.primary }}>{t(`mobile.weekday.${new Date(`${u.planned_on}T00:00:00`).getDay()}`)}</Text>
                <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>{u.planned_on.slice(8, 10)}/{u.planned_on.slice(5, 7)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Body bold>{u.customer_name}</Body>
                <Body muted size={13.5}>{u.item_name ? `${u.item_name} · ${formatDecimal(u.quantity, lang)} ${u.unit}` : t("mobile.lineCount", { count: u.lines })}</Body>
              </View>
              <Pill tone="blue" dashed={u.firmness === "tentative"}>{t(`status.${u.firmness}`)}</Pill>
            </Card>
          </Pressable>
        ))}
        <Title>{t("mobile.arriving")}</Title>
        {arriving.length === 0 && <Card><Body muted>{t("mobile.noArriving")}</Body></Card>}
        {arriving.map((p) => (
          <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${p.contract_id}`)}>
            <Card>
              <Body bold>{p.number} · {p.supplier_name}</Body>
              <Body muted size={13.5}>{t("mobile.forContract", { contract: p.contract_number, customer: p.customer_name })}</Body>
              <Text style={{ fontSize: 14, fontWeight: "600", color: p.late ? colors.danger : colors.textSecondary }}>{p.late ? t("mobile.lateSince", { date: formatDate(p.next_expected_on) }) : t("mobile.expected", { date: formatDate(p.next_expected_on) })}</Text>
            </Card>
          </Pressable>
        ))}
        <View style={{ height: 72 }} />
      </Screen>
      <Pressable accessibilityRole="button" accessibilityLabel={t("mobile.quickNote")} testID="quick-note" onPress={() => router.push("/(app)/note")}
        style={{ position: "absolute", right: 16, bottom: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, minHeight: 52, borderRadius: 26, elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }}>
        <Ionicons name="mic" size={20} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{t("mobile.quickNote")}</Text>
      </Pressable>
    </View>
  );
}
