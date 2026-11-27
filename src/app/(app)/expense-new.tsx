import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApi } from "../../lib/useApi";
import { useT } from "../../lib/i18n";
import { errorMessage, fieldErrors } from "../../lib/errors";
import { formatDate, parseDayInput, parseDecimalInput, todayISO } from "../../lib/format";
import { ApiError, type LocalFile } from "../../lib/api";
import { emptyExpenseForm, fillFromReceipt, queueExpense, readReceipt, receiptHasValues, removePending, sendPending, type ExpenseForm, type PendingExpense, type Receipt } from "../../lib/tripExpenses";
import { TRIP_CATEGORIES, type Trip, type TripCategory } from "../../lib/types";
import { BackHeader, Banner, Button, Card, ChoiceList, Field, colors } from "../../components/ui";
import { ScanDocument } from "../../components/ScanDocument";

/**
 * Add an expense to a trip: photograph the receipt (Navo reads it and fills the empty fields),
 * check the values, save. Without a signal the line waits on the phone and goes out later, once.
 */
export default function NewExpenseScreen() {
  const { trip: tripId } = useLocalSearchParams<{ trip: string }>();
  const { t, lang } = useT();
  const trip = useApi<Trip>(`/trips/${tripId}`);
  const ai = useApi<{ enabled: boolean }>("/ai/status");
  const [form, setForm] = useState<ExpenseForm>(() => emptyExpenseForm(formatDate(todayISO())));
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [queued, setQueued] = useState(false);
  const formRef = useRef(form);
  const touched = useRef(false);
  useEffect(() => { formRef.current = form; }, [form]);
  const set = (patch: Partial<ExpenseForm>) => setForm((f) => ({ ...f, ...patch }));
  const onReading = useCallback((r: Receipt) => {
    const { form: next, filled } = fillFromReceipt(formRef.current, r, touched.current);
    formRef.current = next;
    setForm(next);
    return filled;
  }, []);
  const save = async () => {
    const day = parseDayInput(form.spent_on);
    const amount = parseDecimalInput(form.amount, lang);
    const vat = form.vat_amount.trim() ? parseDecimalInput(form.vat_amount, lang) : "0";
    const errs: Record<string, string> = {};
    if (!day) errs.spent_on = t("validation.date");
    if (amount === null) errs.amount = t("validation.decimal");
    if (vat === null) errs.vat_amount = t("validation.decimal");
    setErrors(errs);
    if (Object.keys(errs).length || !trip.data) return;
    setBusy(true); setError(null);
    const opt = (s: string) => s.trim() || null;
    let p: PendingExpense | null = null;
    try {
      p = await queueExpense(trip.data.id, trip.data.number, { category: form.category, spent_on: day!, amount: amount!, vat_amount: vat!,
        invoice_number: opt(form.invoice_number), seller: opt(form.seller), seller_tax_code: opt(form.seller_tax_code), note: opt(form.note) }, photo);
      if ((await NetInfo.fetch()).isConnected === false) { setQueued(true); setBusy(false); return; }
      await sendPending(p);
      router.back();
    } catch (e) {
      // A lost signal: the line waits on the phone. Refused by the API: back to the form to correct.
      const offline = !(e instanceof ApiError) || e.status === 0;
      if (!offline && p) await removePending(p.id);
      setError(errorMessage(t, e)); setErrors(fieldErrors(t, e)); setQueued(offline); setBusy(false);
    }
  };
  const categories = TRIP_CATEGORIES.map((c) => ({ value: c, label: t(`trips.category.${c}`) }));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <BackHeader title={t("trips.addExpense")} backLabel={t("common.close")} onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {queued && <Banner tone="amber">{t("trips.savedOffline")}</Banner>}
          {error && <Banner tone="red">{error}</Banner>}
          {ai.data?.enabled && !queued && (
            <ScanDocument texts="scanReceipt" fileName="hoa-don.jpg" testPrefix="receipt" photo={photo} onPhoto={setPhoto} read={readReceipt} hasValues={receiptHasValues} onReading={onReading} />
          )}
          <Card>
            <ChoiceList id="expense-category" label={t("trips.categoryLabel")} value={form.category} options={categories} onChange={(c) => { touched.current = true; set({ category: c as TripCategory }); }} />
            <Field id="expense-date" label={t("trips.spentOn")} required placeholder="dd/mm/yyyy" keyboardType="numbers-and-punctuation" value={form.spent_on} onChangeText={(x) => set({ spent_on: x })} error={errors.spent_on} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Field id="expense-amount" label={t("trips.amount")} required keyboardType="decimal-pad" value={form.amount} onChangeText={(x) => set({ amount: x })} error={errors.amount} /></View>
              <View style={{ flex: 1 }}><Field id="expense-vat" label={t("trips.vat")} keyboardType="decimal-pad" value={form.vat_amount} onChangeText={(x) => set({ vat_amount: x })} error={errors.vat_amount} /></View>
            </View>
          </Card>
          <Card>
            <Field id="expense-seller" label={t("trips.seller")} value={form.seller} onChangeText={(x) => set({ seller: x })} error={errors.seller} />
            <Field id="expense-invoice" label={t("trips.invoiceNumber")} value={form.invoice_number} onChangeText={(x) => set({ invoice_number: x })} error={errors.invoice_number} />
            <Field id="expense-tax" label={t("trips.sellerTaxCode")} keyboardType="numbers-and-punctuation" value={form.seller_tax_code} onChangeText={(x) => set({ seller_tax_code: x })} error={errors.seller_tax_code} />
            <Field id="expense-note" label={t("trips.note")} multiline value={form.note} onChangeText={(x) => set({ note: x })} error={errors.note} />
          </Card>
        </ScrollView>
        {!queued && (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.card }}>
            <Button label={t("common.save")} onPress={() => void save()} busy={busy} testID="expense-save" />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
