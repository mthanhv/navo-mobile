import { Pressable } from "react-native";
import { router } from "expo-router";
import { useT } from "../../../lib/i18n";
import { useApi } from "../../../lib/useApi";
import type { Page } from "../../../lib/api";
import type { Contract } from "../../../lib/types";
import { Banner, Body, Card, ErrorBox, Loading, Pill, Screen, Title } from "../../../components/ui";

/** Active contracts in the user's scope; the API decides the scope. */
export default function ContractsScreen() {
  const { t } = useT();
  const { data, error, loading, refreshing, offline, reload } = useApi<Page<Contract>>("/contracts?status=active&page_size=50");
  return (
    <Screen refreshing={refreshing} onRefresh={reload}>
      <Title>{t("contracts.title")}</Title>
      {offline && <Banner tone="amber">{t("mobile.offlineNoData")}</Banner>}
      {loading && !data && <Loading />}
      {error != null && !data && <ErrorBox error={error} onRetry={reload} />}
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
    </Screen>
  );
}
