import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import { compareDecimal, formatDate, formatDecimal, formatMoney } from "../../../lib/format";
import type { Contract, Documents } from "../../../lib/types";
import { Body, Button, Card, DataFreshness, FlagPill, Loading, Pill, Progress, Screen, colors } from "../../../components/ui";

type Seg = "lines" | "pos" | "dos";

/** Contract → lines / purchase orders / deliveries, three clearly different labels (AC-21). */
export default function ContractScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const contract = useApi<Contract>(`/contracts/${id}`);
  const docs = useApi<Documents>(`/contracts/${id}/documents`);
  const [seg, setSeg] = useState<Seg>("lines");
  const n = (v: string) => formatDecimal(v, lang);
  const c = contract.data;
  const reload = () => { contract.reload(); docs.reload(); };

  const header = (
    <View style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text accessibilityRole="header" style={{ fontSize: 19, fontWeight: "800", color: colors.text }}>{c?.number ?? c?.draft_number ?? ""}</Text>
          <Text numberOfLines={1} style={{ fontSize: 13.5, color: colors.textSecondary }}>{c ? `${c.customer_name} · ${t(`status.${c.status}`)}` : ""}</Text>
        </View>
      </View>
      {c && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[[t("mobile.fact.value"), c.value ? formatMoney(c.value, c.currency, lang) : "—"], [t("mobile.fact.finalDue"), formatDate(c.final_due_on) || "—"], [t("mobile.fact.owner"), c.owner_name]].map(([label, value]) => (
            <View key={label} style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>{value}</Text>
            </View>
          ))}
        </View>
      )}
      {c?.summary && (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {[[t("contract.stepOrder"), c.summary.fully_ordered], [t("contract.stepReceive"), c.summary.fully_received], [t("contract.stepDeliver"), c.summary.fully_delivered]].map(([label, done]) => (
            <View key={String(label)} style={{ flex: 1, padding: 8, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>{label}</Text>
              <Text style={{ fontSize: 15, fontWeight: "800", color: colors.primary }}>{done}/{c.summary?.lines}</Text>
            </View>
          ))}
        </View>
      )}
      <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, backgroundColor: colors.background, borderRadius: 12 }}>
        {([["lines", t("mobile.segLines")], ["pos", t("mobile.segPOs")], ["dos", t("mobile.segDOs")]] as [Seg, string][]).map(([key, label]) => (
          <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: seg === key }} onPress={() => setSeg(key)}
            style={{ flex: 1, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: seg === key ? colors.card : "transparent" }}>
            <Text style={{ fontWeight: "700", fontSize: 14.5, color: seg === key ? colors.primary : colors.textSecondary }}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <Screen header={header} refreshing={contract.refreshing} onRefresh={reload}>
      <DataFreshness {...contract} onRetry={reload} />
      {contract.loading && !c && <Loading />}
      {c && seg === "lines" && c.lines?.map((l) => (
        <Card key={l.contract_line_id}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}><Body muted size={13}>{t("contracts.colLine")} {l.line_no}</Body><Body bold size={16}>{l.name_on_contract}</Body></View>
            <FlagPill flag={l.flags[0]} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <Body muted size={14}>{t("mobile.stillToDeliver")}</Body>
            <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{n(l.remaining)}</Text>
            <Body muted size={14}>/ {n(l.contract_quantity)} {l.unit}</Body>
          </View>
          <Progress delivered={l.delivered} received={l.received} total={l.contract_quantity} />
          <Body muted size={13.5}>{t("line.delivered")} {n(l.delivered)} · {t("line.available")} {n(l.available)} · {t("line.ordered")} {n(l.ordered)}</Body>
          <View style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body muted size={13}>{t("mobile.nextDelivery")}</Body>
              {l.next_delivery
                ? <Pill tone="blue" dashed={l.next_delivery.firmness === "tentative"}>{formatDate(l.next_delivery.planned_on)} · {t(`status.${l.next_delivery.firmness}`)}</Pill>
                : l.remaining === "0" ? <Body>—</Body> : <Pill tone="amber">{t("contract.noPlan")}</Pill>}
              <Body muted size={13}>{t("mobile.owner", { name: l.owner_name })}</Body>
            </View>

          </View>
        </Card>
      ))}
      {c && seg === "pos" && (
        <>
          <DataFreshness {...docs} onRetry={docs.reload} />
          {docs.loading && !docs.data && <Loading />}
          <Body muted size={13.5}>{t("mobile.poMeaning")}</Body>
          {docs.data?.purchase_orders.length === 0 && <Card><Body muted>{t("docs.none")}</Body></Card>}
          {docs.data?.purchase_orders.map((po) => (
            <Card key={po.id}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Pill tone="blue">{t("mobile.poLabel")}</Pill><Body bold>{po.number}</Body></View>
              <Body>{po.supplier_name}</Body>
              {po.lines.map((pl) => <Body key={pl.id} muted size={13.5}>{t("contracts.colLine")} {pl.contract_line_no} · {t("docs.receivedOf", { received: n(pl.received), ordered: n(pl.quantity) })} {pl.unit}{pl.expected_on ? ` · ETA ${formatDate(pl.expected_on)}` : ""}</Body>)}
              <Pill tone={po.status === "confirmed" ? (po.lines.every((pl) => compareDecimal(pl.received, pl.quantity) >= 0) ? "green" : "blue") : "gray"}>{t(`status.${po.status}`)}</Pill>
            </Card>
          ))}
        </>
      )}
      {c && seg === "dos" && (
        <>
          <Body muted size={13.5}>{t("mobile.doMeaning")}</Body>
          <DataFreshness {...docs} onRetry={docs.reload} />
          {docs.loading && !docs.data && <Loading />}
          {docs.data?.delivery_orders.length === 0 && <Card><Body muted>{t("docs.none")}</Body></Card>}
          {docs.data?.delivery_orders.map((d) => (
            <Card key={d.id}>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Pill tone="green">{t("mobile.doLabel")}</Pill><Body bold>{d.number}</Body></View>
              {d.lines.map((dl) => <Body key={dl.contract_line_id} muted size={13.5}>{t("contracts.colLine")} {dl.contract_line_no} · {n(dl.quantity)}</Body>)}
              {d.status === "confirmed"
                ? <Pill tone="green">✓ {t("docs.deliveredOn", { date: formatDate(d.delivered_on) })}</Pill>
                : d.planned_on ? <Pill tone="blue" dashed={d.firmness === "tentative"}>{formatDate(d.planned_on)} · {t(`status.${d.firmness}`)}</Pill> : <Pill tone="gray">{t("docs.noDate")}</Pill>}
            </Card>
          ))}
        </>
      )}
      {c && <Button label={t("mobile.quickNote")} tone="outline" onPress={() => router.push({ pathname: "/(app)/note", params: { customer: c.customer_id, contract: c.id } })} testID="contract-note" />}
      {c && <Body muted size={12.5}>{t("mobile.webOnly")}</Body>}
    </Screen>
  );
}
