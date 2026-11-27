import { useCallback, useState } from "react";
import { View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import { api } from "../../../lib/api";
import { useApi } from "../../../lib/useApi";
import { useSession } from "../../../lib/session";
import { useT } from "../../../lib/i18n";
import { errorMessage } from "../../../lib/errors";
import { formatDate, formatMoney } from "../../../lib/format";
import { listPending, sendPending, type PendingExpense } from "../../../lib/tripExpenses";
import type { Trip } from "../../../lib/types";
import { BackHeader, Banner, Body, Button, Card, DataFreshness, ErrorBox, Loading, Pill, Screen } from "../../../components/ui";
import { TripPill } from "../../../components/Trips";

/**
 * One trip on the phone: where and why, the expenses (and those still waiting for a signal),
 * the advance and what is left; the traveller adds expenses, asks for the advance and submits
 * the settlement. Deciding and paying happen on the web.
 */
export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useT();
  const { me } = useSession();
  const r = useApi<Trip>(`/trips/${id}`);
  const [pending, setPending] = useState<PendingExpense[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keys] = useState(() => ({ advance: Crypto.randomUUID(), submit: Crypto.randomUUID() }));
  const refresh = useCallback(() => { void listPending(id).then(setPending); r.reload(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useFocusEffect(refresh);
  const trip = r.data;
  const header = <BackHeader title={trip ? trip.number : t("trips.title")} backLabel={t("common.close")} onBack={() => router.back()} />;
  if (!trip) return <Screen header={header}>{r.error != null ? <ErrorBox error={r.error} onRetry={r.reload} /> : <Loading />}</Screen>;
  const mine = trip.traveller_id === me?.user.id;
  const open = trip.status === "draft" || trip.status === "in_progress" || trip.status === "advance_pending";
  const money = (v: string) => formatMoney(v, trip.currency, lang);
  const act = async (path: string, key: string) => {
    setBusy(true); setError(null);
    try { await api(`/trips/${trip.id}/${path}`, { method: "POST", idempotencyKey: key, body: { version: trip.version } }); r.reload(); }
    catch (e) { setError(errorMessage(t, e)); }
    finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true); setError(null);
    const results = await Promise.allSettled(pending.map(sendPending));
    const failed = results.find((x) => x.status === "rejected");
    if (failed && failed.status === "rejected") setError(errorMessage(t, failed.reason));
    setBusy(false); refresh();
  };
  const balance = Number(trip.balance);
  const lines = (trip.expenses ?? []).filter((l) => !l.voided_at);
  return (
    <Screen header={header} refreshing={r.refreshing} onRefresh={refresh}>
      <DataFreshness data={r.data} error={r.error} fetchedAt={r.fetchedAt} offline={r.offline} onRetry={r.reload} />
      {error && <Banner tone="red">{error}</Banner>}
      <Card>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><View style={{ flex: 1 }}><Body bold size={17}>{trip.purpose}</Body></View><TripPill trip={trip} /></View>
        <Body muted size={14}>{formatDate(trip.start_on)} – {formatDate(trip.end_on)}{trip.destination ? ` · ${trip.destination}` : ""}</Body>
        {(trip.contract_number || trip.organization_name) && <Body size={14}>{[trip.contract_number, trip.organization_name].filter(Boolean).join(" · ")}</Body>}
        {trip.decision_note && <Body size={14}>{t("trips.decisionNote")}: {trip.decision_note}</Body>}
      </Card>
      <Card>
        <Body size={14}>{t("trips.colExpenses")}: <Body bold>{money(trip.expenses_total)}</Body></Body>
        <Body size={14}>{t("trips.advance")}: {trip.advance_requested ? `${money(trip.advance_requested)}${trip.advance_approved ? ` · ${t("trips.approvedAmount", { amount: money(trip.advance_approved) })}` : ""}` : t("trips.noAdvance")}</Body>
        {Number(trip.advanced) > 0 && <Body size={14}>{t("trips.colAdvanced")}: {money(trip.advanced)}</Body>}
        {balance !== 0 && <Body size={14}>{t(balance < 0 ? "trips.owed" : "trips.holds")}: <Body bold>{money(String(Math.abs(balance)))}</Body></Body>}
      </Card>
      {pending.length > 0 && (
        <Card>
          <Body bold>{t("trips.waiting", { count: pending.length })}</Body>
          {pending.map((p) => <Body key={p.id} size={14}>{t(`trips.category.${p.body.category}`)} · {money(p.body.amount)}</Body>)}
          <Button testID="trip-resend" label={t("trips.sendAgain")} tone="outline" busy={busy} onPress={() => void resend()} />
        </Card>
      )}
      <Card>
        <Body bold>{t("trips.expenses")}</Body>
        {lines.length === 0 ? <Body muted>{t("trips.noExpenses")}</Body> : lines.map((l) => (
          <View key={l.id} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
            <View style={{ flex: 1 }}>
              <Body size={14.5}>{t(`trips.category.${l.category}`)} · {formatDate(l.spent_on)}</Body>
              {(l.seller || l.review_note) && <Body muted size={13}>{[l.seller, l.review_note].filter(Boolean).join(" · ")}</Body>}
            </View>
            <Body size={14.5}>{money(l.amount)}</Body>
            {l.review_status !== "submitted" && <Pill tone={l.review_status === "accepted" ? "green" : "red"}>{t(`trips.review.${l.review_status}`)}</Pill>}
          </View>
        ))}
      </Card>
      {mine && open && <Button testID="trip-add-expense" label={t("trips.addExpense")} onPress={() => router.push({ pathname: "/(app)/expense-new", params: { trip: trip.id } })} />}
      {mine && trip.status === "draft" && trip.advance_requested && <Button testID="trip-request-advance" label={t("trips.requestAdvance")} tone="outline" busy={busy} onPress={() => void act("request-advance", keys.advance)} />}
      {mine && (trip.status === "draft" || trip.status === "in_progress") && lines.length > 0 && pending.length === 0 &&
        <Button testID="trip-submit" label={t("trips.submit")} tone="outline" busy={busy} onPress={() => void act("submit", keys.submit)} />}
    </Screen>
  );
}
