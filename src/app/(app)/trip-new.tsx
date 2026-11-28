import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useApi } from "../../lib/useApi";
import { useT } from "../../lib/i18n";
import { errorMessage, fieldErrors } from "../../lib/errors";
import { formatDate, parseDayInput, parseDecimalInput, todayISO } from "../../lib/format";
import type { Page } from "../../lib/api";
import type { Contract, Trip } from "../../lib/types";
import { BackHeader, Banner, Button, Card, ChoiceList, Field, NumberField, colors } from "../../components/ui";

/** A new business trip: purpose, where, when, the contract it serves (optional), an advance. */
export default function NewTripScreen() {
  const { t, lang } = useT();
  const contracts = useApi<Page<Contract>>("/contracts?tab=all&status=active&page_size=100");
  const today = formatDate(todayISO());
  const [v, setV] = useState({ purpose: "", destination: "", start: today, end: today, contract: "", advance: "" });
  const [key] = useState(() => Crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = async () => {
    const start = parseDayInput(v.start), end = parseDayInput(v.end);
    const advance = v.advance.trim() ? parseDecimalInput(v.advance, lang) : null;
    const errs: Record<string, string> = {};
    if (!v.purpose.trim()) errs.purpose = t("validation.required");
    if (!start) errs.start_on = t("validation.date");
    if (!end) errs.end_on = t("validation.date");
    if (v.advance.trim() && advance === null) errs.advance_requested = t("validation.decimal");
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError(null);
    try {
      const trip = await api<Trip>("/trips", { method: "POST", idempotencyKey: key, body: {
        purpose: v.purpose.trim(), destination: v.destination.trim() || null, start_on: start, end_on: end, contract_id: v.contract || null, advance_requested: advance,
      } });
      router.replace(`/(app)/trip/${trip.id}`);
    } catch (e) {
      setError(errorMessage(t, e)); setErrors(fieldErrors(t, e)); setBusy(false);
    }
  };
  const options = [{ value: "", label: t("trips.noContract") }, ...(contracts.data?.items ?? []).map((c) => ({ value: c.id, label: `${c.number ?? c.title} · ${c.customer_name}` }))];
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <BackHeader title={t("trips.new")} backLabel={t("common.close")} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {error && <Banner tone="red">{error}</Banner>}
          <Card>
            <Field id="trip-purpose" label={t("trips.purpose")} required hint={t("trips.purposeHint")} value={v.purpose} onChangeText={(x) => setV({ ...v, purpose: x })} error={errors.purpose} />
            <Field id="trip-destination" label={t("trips.destination")} value={v.destination} onChangeText={(x) => setV({ ...v, destination: x })} error={errors.destination} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field id="trip-start" label={t("trips.startOn")} required placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" value={v.start} onChangeText={(x) => setV({ ...v, start: x })} error={errors.start_on} /></View>
              <View style={{ flex: 1 }}><Field id="trip-end" label={t("trips.endOn")} required placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" value={v.end} onChangeText={(x) => setV({ ...v, end: x })} error={errors.end_on} /></View>
            </View>
          </Card>
          <Card>
            <ChoiceList id="trip-contract" label={t("trips.contract")} value={v.contract} options={options} onChange={(x) => setV({ ...v, contract: x })} />
            <NumberField id="trip-advance" label={t("trips.advanceAsk")} hint={t("trips.advanceHint")} value={v.advance} onChangeText={(x) => setV({ ...v, advance: x })} error={errors.advance_requested} />
          </Card>
        </ScrollView>
        <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.card }}>
          <Button label={t("common.save")} onPress={() => void save()} busy={busy} testID="trip-save" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
