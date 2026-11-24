import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useT } from "../lib/i18n";
import { useApi } from "../lib/useApi";
import { formatDate } from "../lib/format";
import type { ServiceVisit } from "../lib/api-types";
import { Body, Card, DataFreshness, Loading, Pill, Screen, Title, colors } from "./ui";

/** A visit's status in words and colour (never colour alone). */
export function VisitPill({ v }: { v: ServiceVisit }) {
  const { t } = useT();
  if (v.status === "planned" && v.overdue) return <Pill tone="red">{t("service.overdue")}</Pill>;
  return <Pill tone={v.status === "done" ? "green" : v.status === "planned" ? "blue" : "gray"}>{t(`service.status.${v.status}`)}</Pill>;
}

/**
 * The visits list: a technician's own (their home screen), or every planned one for planners.
 * Each opens the visit, where it is recorded with photos of the signed report.
 */
export function VisitList({ mine, header }: { mine: boolean; header?: ReactNode }) {
  const { t } = useT();
  const { data, error, fetchedAt, loading, refreshing, offline, reload } = useApi<ServiceVisit[]>(`/service-visits?status=planned${mine ? "&mine=1" : ""}`);
  return (
    <Screen refreshing={refreshing} onRefresh={reload} header={header}>
      {!header && <Title>{t("service.title")}</Title>}
      <Body muted size={13.5}>{t(mine ? "service.mineHint" : "service.allHint")}</Body>
      <DataFreshness data={data} error={error} fetchedAt={fetchedAt} offline={offline} onRetry={reload} />
      {loading && !data && <Loading />}
      {data?.length === 0 && <Card><Body muted>{t(mine ? "service.noneMine" : "service.none")}</Body></Card>}
      {data?.map((v) => (
        <Pressable key={v.id} testID={`visit-${v.number}`} accessibilityRole="button" onPress={() => router.push(`/(app)/visit/${v.id}`)}>
          <Card>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <VisitPill v={v} />
              {v.urgency === "urgent" && <Pill tone="amber">{t("service.urgent")}</Pill>}
              <Body bold>{v.number}</Body>
            </View>
            <Body bold size={16}>{v.customer_name}</Body>
            {v.location && <Body>{v.location}</Body>}
            <Body muted size={13.5}>{v.planned_on ? formatDate(v.planned_on) : t("service.noDate")} · {t(`service.kinds.${v.kind}`)}</Body>
            {v.lines.map((l) => <Body key={l.contract_line_id} size={14}>{l.name_on_contract}</Body>)}
            {v.description && <Body size={14}>{v.description}</Body>}
            {!mine && <Text style={{ fontSize: 13.5, color: v.assignee_name ? colors.textSecondary : colors.warning }}>{v.assignee_name ?? t("service.unassigned")}</Text>}
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
