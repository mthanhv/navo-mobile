import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import { formatDate } from "../../../lib/format";
import type { Page } from "../../../lib/api";
import type { DOSummary, POSummary } from "../../../lib/types";
import { Body, Button, Card, DataFreshness, Loading, Pill, Screen, Title, colors } from "../../../components/ui";

type Seg = "pos" | "dos";

/**
 * Leaders' operations report (N-09, AC-21): purchase orders still waiting for goods and the
 * deliveries planned to customers, kept apart and labelled, each opening its contract.
 */
export default function OrdersScreen() {
  const { t } = useT();
  const [seg, setSeg] = useState<Seg>("pos");
  const [page, setPage] = useState(1);
  const path = seg === "pos" ? `/purchase-orders?view=awaiting&page_size=50&page=${page}` : `/delivery-orders?view=planned&page_size=50&page=${page}`;
  const { data, error, fetchedAt, loading, refreshing, offline, reload } = useApi<Page<POSummary | DOSummary>>(path);
  const pick = (s: Seg) => { setSeg(s); setPage(1); };
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title>{t("mobile.orders.title")}</Title>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, backgroundColor: colors.background, borderRadius: 12 }}>
        {([["pos", t("mobile.orders.awaiting")], ["dos", t("mobile.orders.planned")]] as [Seg, string][]).map(([key, label]) => (
          <Pressable key={key} testID={`orders-${key}`} accessibilityRole="tab" accessibilityState={{ selected: seg === key }} onPress={() => pick(key)}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: seg === key ? colors.card : "transparent" }}>
            <Text style={{ fontWeight: "700", fontSize: 14.5, color: seg === key ? colors.primary : colors.textSecondary }}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Body muted size={13.5}>{seg === "pos" ? t("mobile.poMeaning") : t("mobile.doMeaning")}</Body>
      <DataFreshness data={data} error={error} fetchedAt={fetchedAt} offline={offline} onRetry={reload} />
      {loading && !data && <Loading />}
      {data?.items.length === 0 && <Card><Body muted>{seg === "pos" ? t("mobile.orders.noneAwaiting") : t("mobile.orders.nonePlanned")}</Body></Card>}
      {data?.items.map((x) => {
        const po = seg === "pos" ? (x as POSummary) : null;
        const d = seg === "dos" ? (x as DOSummary) : null;
        return (
          <Pressable key={x.id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${x.contract_id}`)}>
            <Card>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Pill tone="blue">{po ? t("mobile.poLabel") : t("mobile.doLabel")}</Pill>
                <Body bold>{x.number}</Body>
              </View>
              <Body bold size={16}>{x.customer_name}</Body>
              {po && <>
                <Body>{po.supplier_name} · {t("mobile.orders.received", { done: po.lines_fully_received, total: po.lines })}</Body>
                {po.late ? <Pill tone="red">{t("mobile.orders.late", { date: formatDate(po.next_expected_on) })}</Pill>
                  : po.next_expected_on ? <Body muted size={13.5}>{t("mobile.orders.eta", { date: formatDate(po.next_expected_on) })}</Body>
                  : <Body muted size={13.5}>{t("mobile.orders.noEta")}</Body>}
              </>}
              {d && <>
                <Body>{t("mobile.orders.lines", { count: d.lines })}</Body>
                {d.planned_on
                  ? <Pill tone={d.overdue ? "red" : "blue"} dashed={d.firmness === "tentative"}>{formatDate(d.planned_on)} · {t(`status.${d.firmness}`)}{d.overdue ? ` · ${t("mobile.orders.overdue")}` : ""}</Pill>
                  : <Pill tone="amber">{t("mobile.orders.noDate")}</Pill>}
              </>}
            </Card>
          </Pressable>
        );
      })}
      {page > 1 && <Button label={t("common.prev")} tone="outline" onPress={() => setPage(page - 1)} />}
      {data && page < data.pagination.totalPages && <Button label={t("common.next")} onPress={() => setPage(page + 1)} />}
    </Screen>
  );
}
