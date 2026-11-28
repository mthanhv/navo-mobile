import { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import NetInfo from "@react-native-community/netinfo";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, upload, type LocalFile } from "../../lib/api";
import { emptyLeadForm, fillFromCard, type Card as CardReading, type LeadForm } from "../../lib/cardScan";
import { errorMessage, fieldErrors } from "../../lib/errors";
import { parseDecimalInput } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { Banner, Body, Button, Card, ChoiceList, Field, colors } from "../../components/ui";
import { ScanCard } from "../../components/ScanCard";

const SOURCES = ["referral", "trade_show", "website", "cold_call", "zalo", "existing_customer", "other"] as const;

type Dup = { id: string; code: string; name: string; kind: "customer" | "supplier" | "lead"; owner_name: string | null; reason: "tax_code" | "name" | "phone" };
type Lead = { id: string; name: string };

/** Add a lead on the phone, by scanning a business card or by hand (the web's "Thêm khách tiềm năng"). */
export default function NewLeadScreen() {
  const { t, lang } = useT();
  const [form, setForm] = useState<LeadForm>(emptyLeadForm);
  const [photo, setPhoto] = useState<LocalFile | null>(null);
  const [aiOn, setAiOn] = useState(false);
  const [dups, setDups] = useState<Dup[]>([]);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ lead: Lead; photoSaved: boolean } | null>(null);
  // One key per lead being added: a retry after a lost answer never adds it twice.
  const key = useRef(Crypto.randomUUID());
  const photoKey = useRef(Crypto.randomUUID());
  const created = useRef<Lead | null>(null);
  const formRef = useRef(form);
  useEffect(() => { formRef.current = form; }, [form]);

  useEffect(() => {
    api<{ enabled: boolean }>("/ai/status").then((s) => setAiOn(s.enabled)).catch(() => setAiOn(false));
    return NetInfo.addEventListener((s) => setOffline(s.isConnected === false));
  }, []);

  // A company already in Navo (same tax code, similar name or a known phone) is shown before saving.
  const phones = [form.phone, form.contact.phone].map((p) => p.trim()).filter(Boolean).join("|");
  const dupQuery = !!(form.name.trim() || form.tax_code.trim() || phones);
  useEffect(() => {
    if (!dupQuery) return;
    const timer = setTimeout(() => {
      api<Dup[]>("/leads/duplicates", { method: "POST", body: { name: form.name, tax_code: form.tax_code, phones: phones ? phones.split("|") : [] } })
        .then(setDups).catch(() => setDups([]));
    }, 400);
    return () => clearTimeout(timer);
  }, [dupQuery, form.name, form.tax_code, phones]);

  const set = (patch: Partial<LeadForm>) => setForm((f) => ({ ...f, ...patch }));
  const setContact = (patch: Partial<LeadForm["contact"]>) => setForm((f) => ({ ...f, contact: { ...f.contact, ...patch } }));
  const onReading = useCallback((card: CardReading) => {
    const { form: next, filled } = fillFromCard(formRef.current, card);
    formRef.current = next;
    setForm(next);
    return filled;
  }, []);

  /** The card photo goes on a note on the lead (a lead holds no files of its own). */
  const keepPhoto = async (lead: Lead, card: LocalFile) => {
    const note = await api<{ id: string }>("/activities", { method: "POST", idempotencyKey: `card-${photoKey.current}`, body: { kind: "note", organization_id: lead.id, summary: t("leads.cardNote") } });
    await upload("/files", { owner_type: "note", owner_id: note.id, doc_kind: "photo", client_id: photoKey.current }, card);
  };

  const save = async () => {
    if (busy) return;
    const value = form.estimated_value.trim() ? parseDecimalInput(form.estimated_value, lang) : null;
    if (form.estimated_value.trim() && value === null) { setErrors({ estimated_value: t("validation.decimal") }); return; }
    setBusy(true); setError(null); setErrors({});
    const c = form.contact;
    const hasContact = !!(c.full_name.trim() || c.job_title.trim() || c.phone.trim() || c.email.trim());
    const opt = (s: string) => s.trim() || null;
    try {
      const lead = created.current ?? await api<Lead>("/leads", { method: "POST", idempotencyKey: key.current, body: {
        name: form.name, tax_code: opt(form.tax_code), address: opt(form.address), website: opt(form.website), phone: opt(form.phone),
        source: opt(form.source), industry: opt(form.industry), interest: opt(form.interest), estimated_value: value,
        contacts: hasContact ? [{ full_name: c.full_name, job_title: opt(c.job_title), phone: opt(c.phone), email: opt(c.email), is_primary: true }] : [],
      } });
      created.current = lead;
      let photoSaved = true;
      if (photo) {
        try { await keepPhoto(lead, photo); } catch { photoSaved = false; }
      }
      setDone({ lead, photoSaved });
      if (photoSaved) setTimeout(() => router.back(), 1200);
    } catch (e) {
      setError(errorMessage(t, e));
      setErrors(fieldErrors(t, e));
    } finally {
      setBusy(false);
    }
  };

  const fieldProps = (id: keyof Omit<LeadForm, "contact">) => ({ id: `lead-${id}`, value: form[id], error: errors[id], onChangeText: (v: string) => set({ [id]: v }), editable: !done });
  const contactProps = (id: keyof LeadForm["contact"]) => ({ id: `lead-contact-${id}`, value: form.contact[id], error: errors[`contacts[0].${id}`], onChangeText: (v: string) => setContact({ [id]: v }), editable: !done });
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("common.close")} onPress={() => router.back()} style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </Pressable>
        <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{t("leads.add")}</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
          {done && (
            <View accessibilityRole="alert" style={{ padding: 14, borderRadius: 12, gap: 8, backgroundColor: done.photoSaved ? colors.successLight : colors.warningLight }}>
              <Body bold>{t("leads.created", { name: done.lead.name })}</Body>
              {!done.photoSaved && <>
                <Body size={14}>{t("leads.photoNotSaved")}</Body>
                <Button label={t("common.close")} tone="outline" onPress={() => router.back()} testID="lead-done" />
              </>}
            </View>
          )}
          {offline && !done && <Banner tone="amber">{t("leads.offline")}</Banner>}
          {error && <Banner tone="red">{error}</Banner>}

          {aiOn && !done && <ScanCard photo={photo} onPhoto={setPhoto} onReading={onReading} />}

          {dupQuery && dups.length > 0 && !done && (
            <View testID="lead-duplicates" accessibilityRole="alert" style={{ padding: 12, borderRadius: 12, gap: 4, backgroundColor: colors.warningLight }}>
              <Text style={{ fontWeight: "700", color: colors.warning, fontSize: 14.5 }}>{t("leads.dupTitle")}</Text>
              {dups.map((d) => (
                <Text key={d.id} style={{ color: colors.text, fontSize: 14 }}>
                  • {d.name} ({t(`leads.dupKind.${d.kind}`)}{d.owner_name ? ` · ${d.owner_name}` : ""}) — {t(`leads.dupReason.${d.reason}`)}
                </Text>
              ))}
            </View>
          )}

          <Card>
            <Field {...fieldProps("name")} label={t("partners.name")} required />
            <Field {...fieldProps("tax_code")} label={t("partners.taxCode")} hint={t("common.optional")} keyboardType="numbers-and-punctuation" />
            <Field {...fieldProps("phone")} label={t("leads.companyPhone")} hint={t("leads.companyPhoneHint")} keyboardType="phone-pad" />
            <Field {...fieldProps("website")} label={t("leads.website")} hint={t("common.optional")} keyboardType="url" autoCapitalize="none" autoCorrect={false} />
            <Field {...fieldProps("address")} label={t("leads.address")} hint={t("common.optional")} multiline />
          </Card>

          <Card>
            <Body bold>{t("contacts.title")}</Body>
            <Field {...contactProps("full_name")} label={t("contacts.fullName")} />
            <Field {...contactProps("job_title")} label={t("contacts.jobTitle")} />
            <Field {...contactProps("phone")} label={t("contacts.phone")} keyboardType="phone-pad" />
            <Field {...contactProps("email")} label={t("contacts.email")} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          </Card>

          <Card>
            <Field {...fieldProps("industry")} label={t("leads.industry")} hint={t("leads.industryHint")} />
            <ChoiceList id="lead-source" label={t("leads.sourceLabel")} value={form.source} onChange={(v) => set({ source: v })}
              options={[{ value: "", label: t("partners.notSet") }, ...SOURCES.map((s) => ({ value: s, label: t(`leads.source.${s}`) }))]} />
            {errors.source && <Text style={{ fontSize: 13.5, color: colors.danger }}>{errors.source}</Text>}
            <Field {...fieldProps("interest")} label={t("leads.interest")} hint={t("leads.interestHint")} multiline />
            <Field {...fieldProps("estimated_value")} label={t("leads.estimatedValue")} hint={t("leads.valueHint")} keyboardType="decimal-pad" />
          </Card>
        </ScrollView>
        {!done && (
          <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.card }}>
            <Button label={t("common.save")} onPress={() => void (offline ? setError(t("leads.offline")) : save())} busy={busy} testID="lead-save" />
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
