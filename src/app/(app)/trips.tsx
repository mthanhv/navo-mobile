import { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useT } from "../../lib/i18n";
import { useApi } from "../../lib/useApi";
import { formatDate, formatMoney } from "../../lib/format";
import { listPending, sendPending, type PendingExpense } from "../../lib/tripExpenses";
import type { Page } from "../../lib/api";
import type { Trip } from "../../lib/types";
import { BackHeader, Banner, Body, Button, Card, DataFreshness, Loading, Screen } from "../../components/ui";
import { TripPill } from "../../components/Trips";

/** My business trips (công tác phí): open ones first, with what was spent and what is left. */
export default function TripsScreen() {
  const { t, lang } = useT();
  const list = useApi<Page<Trip>>("/trips?view=mine&page_size=50");
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const refreshPending = useCallback(() => { void listPending().then(setPending); }, []);
  useFocusEffect(useCallback(() => { refreshPending(); list.reload(); }, [refreshPending])); // eslint-disable-line react-hooks/exhaustive-deps
  // Lines saved without a signal go out by themselves when the list is opened online.
  useEffect(() => {
    if (list.offline || pending.length === 0) return;
    void Promise.allSettled(pending.map(sendPending)).then(() => { refreshPending(); list.reload(); });
  }, [list.offline, pending.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = list.data?.items ?? [];
  const open = items.filter((x) => x.status !== "closed" && x.status !== "cancelled");
  const done = items.filter((x) => x.status === "closed" || x.status === "cancelled");
  return (
    <Screen header={<BackHeader title={t("nav.trips")} backLabel={t("common.close")} onBack={() => router.back()} />} refreshing={list.refreshing} onRefresh={list.reload}>
      <DataFreshness data={list.data} error={list.error} fetchedAt={list.fetchedAt} offline={list.offline} onRetry={list.reload} />
      {pending.length > 0 && <Banner tone="amber">{t("trips.pendingLines", { count: pending.length })}</Banner>}
      <Button testID="trip-new" label={t("trips.new")} onPress={() => router.push("/(app)/trip-new")} />
      {list.loading && !list.data ? <Loading /> : items.length === 0 ? <Card><Body muted>{t("trips.empty.mine")}</Body></Card> : (
        <>
          {[...open, ...done].map((trip) => (
            <Pressable key={trip.id} testID={`trip-${trip.number}`} accessibilityRole="button" onPress={() => router.push(`/(app)/trip/${trip.id}`)}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ flex: 1 }}><Body bold>{trip.number} · {trip.purpose}</Body></View>
                  <TripPill trip={trip} />
                </View>
                <Body muted size={14}>{formatDate(trip.start_on)} – {formatDate(trip.end_on)}{trip.destination ? ` · ${trip.destination}` : ""}{trip.contract_number ? ` · ${trip.contract_number}` : ""}</Body>
                <Body size={14}>{t("trips.colExpenses")}: {formatMoney(trip.expenses_total, trip.currency, lang)}{Number(trip.advanced) > 0 ? ` · ${t("trips.colAdvanced")}: ${formatMoney(trip.advanced, trip.currency, lang)}` : ""}</Body>
              </Card>
            </Pressable>
          ))}
        </>
      )}
    </Screen>
  );
}
