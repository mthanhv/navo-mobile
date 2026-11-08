import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSession } from "../../../lib/session";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import { formatDate, formatDecimal } from "../../../lib/format";
import { nextActionText } from "../../../lib/contractText";
import type { Overview } from "../../../lib/types";
import { Banner, Body, Card, ErrorBox, FlagPill, Loading, Pill, Screen, Title, colors } from "../../../components/ui";

/** Leadership/sales home (S-01, AC-21/24): needs attention, summary, coming up; stale data is labelled. */
export default function OverviewScreen() {
  const { t, lang } = useT();
  const { me, can } = useSession();
  const first = me?.user.full_name.split(" ").pop() ?? "";
  if (!can("contracts.read")) {
    return (
      <Screen header={<Hero name={first} sub={t("overview.adminIntro")} />}>
        <Card><Body muted>{t("mobile.webOnly")}</Body></Card>
      </Screen>
    );
  }
  return <ScopedOverview first={first} lang={lang} />;
}

function Hero({ name, sub }: { name: string; sub: string }) {
  const { t } = useT();
  return (
    <View style={{ backgroundColor: colors.hero, padding: 20, paddingTop: 12, gap: 4 }}>
      <Text style={{ color: "#B9D1F5", fontSize: 14 }}>{t("overview.greeting", { name })}</Text>
      <Text accessibilityRole="header" style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{t("mobile.tabs.overview")}</Text>
      <Text style={{ color: "#B9D1F5", fontSize: 13.5 }}>{sub}</Text>
    </View>
  );
}

function ScopedOverview({ first, lang }: { first: string; lang: "vi" | "en" }) {
  const { t } = useT();
  const { data, fetchedAt, error, loading, refreshing, offline, reload } = useApi<Overview>("/reports/overview");
  const time = fetchedAt ? fetchedAt.toLocaleTimeString(lang === "vi" ? "vi-VN" : "en-GB", { hour: "2-digit", minute: "2-digit" }) : "";
  const stats = data ? [
    { label: t("overview.needsActionCount"), value: data.needs_action, color: data.needs_action > 0 ? colors.danger : colors.text },
    { label: t("overview.linesRemaining"), value: data.lines_remaining, color: colors.text },
    { label: t("overview.activeContracts"), value: data.active_contracts, color: colors.text },
    { label: t("overview.poAwaiting"), value: data.purchase_orders_awaiting_goods, color: colors.text },
  ] : [];
  return (
    <Screen refreshing={refreshing} onRefresh={reload} header={<Hero name={first} sub={time ? t("common.asOf", { time }) : t("mobile.pullHint")} />}>
      {offline && (data ? <Banner tone="amber">{t("mobile.offline", { time })}</Banner> : <Banner tone="amber">{t("mobile.offlineNoData")}</Banner>)}
      {loading && !data && <Loading />}
      {error != null && !data && <ErrorBox error={error} onRetry={reload} />}
      {data && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {stats.map((s) => (
              <Card key={s.label} style={{ flexBasis: "47%", flexGrow: 1 }}>
                <Body muted size={13.5}>{s.label}</Body>
                <Text style={{ fontSize: 28, fontWeight: "800", color: s.color }}>{formatDecimal(String(s.value), lang)}</Text>
              </Card>
            ))}
          </View>
          <Title>{t("overview.needsAction")}</Title>
          {data.attention.length === 0 && <Card><Body muted>{t("overview.introClear")}</Body></Card>}
          {data.attention.slice(0, 5).map((row) => (
            <Pressable key={row.contract_line_id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${row.contract_id}`)}>
              <Card>
                <FlagPill flag={row.flags[0]} />
                <Body bold>{nextActionText(t, lang, row, row.flags[0])}</Body>
                <Body muted size={13.5}>{row.contract_number} · {row.customer_name} · {row.owner_name}</Body>
              </Card>
            </Pressable>
          ))}
          <Title>{t("overview.upcoming")}</Title>
          {data.upcoming.length === 0 && <Card><Body muted>{t("overview.noUpcoming")}</Body></Card>}
          {data.upcoming.map((u) => (
            <Pressable key={u.id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${u.contract_id}`)}>
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Body bold>{u.customer_name}</Body>
                  <Body muted size={13.5}>{u.number}</Body>
                </View>
                <Pill tone="blue" dashed={u.firmness === "tentative"}>{formatDate(u.planned_on)} · {t(`status.${u.firmness}`)}</Pill>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
