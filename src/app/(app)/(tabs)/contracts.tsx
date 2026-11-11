import { useState } from "react";
import { Pressable } from "react-native";
import { router } from "expo-router";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import type { Page } from "../../../lib/api";
import type { Contract } from "../../../lib/types";
import { Body, Button, Card, DataFreshness, Loading, Pill, Screen, Title } from "../../../components/ui";

/** Active contracts in the user's scope; the API decides the scope. */
export default function ContractsScreen() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const { data, error, fetchedAt, loading, refreshing, offline, reload } = useApi<Page<Contract>>(`/contracts?status=active&page_size=50&page=${page}`);
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title>{t("contracts.title")}</Title>
      <DataFreshness data={data} error={error} fetchedAt={fetchedAt} offline={offline} onRetry={reload} />
      {loading && !data && <Loading />}
      {data?.items.length === 0 && <Card><Body muted>{t("contracts.empty")}</Body></Card>}
      {data?.items.map((c) => (
        <Pressable key={c.id} accessibilityRole="button" onPress={() => router.push(`/(app)/contract/${c.id}`)}>
          <Card>
            <Body bold size={16}>{c.customer_name}</Body>
            <Body>{c.title}</Body>
            <Body muted size={13.5}>{c.number} · {c.owner_name}</Body>
            <Pill tone="blue">{t(`status.${c.status}`)}</Pill>
          </Card>
        </Pressable>
      ))}
      {page > 1 && <Button label={t("common.prev")} tone="outline" onPress={() => setPage(page - 1)} />}
      {data && page < data.pagination.totalPages && <Button label={t("common.next")} onPress={() => setPage(page + 1)} />}
    </Screen>
  );
}
