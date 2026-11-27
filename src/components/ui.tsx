import { useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";
import type { Flag } from "../lib/types";

/** Tokens follow Lova Driver: slate neutrals, Lova blue, 16 px cards, large type for phones outdoors. */
export const colors = {
  primary: "#1565C0", primaryLight: "#EEF4FD", hero: "#0B1B33", text: "#0F172A", textSecondary: "#475467",
  muted: "#647187", border: "#E2E7EE", divider: "#E9EDF3", background: "#F1F4F8", card: "#FFFFFF",
  inputBorder: "#BDBDBD", danger: "#B42318", dangerLight: "#FDEDEC", warning: "#8A4B00", warningLight: "#FEF5E6", success: "#15803D", successLight: "#E9F7EF",
};

export function Screen({ children, refreshing, onRefresh, header }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; header?: ReactNode }) {
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text accessibilityRole="header" style={styles.title}>{children}</Text>;
}

export function Body({ children, muted, bold, size = 15 }: { children: ReactNode; muted?: boolean; bold?: boolean; size?: number }) {
  return <Text style={{ fontSize: size, color: muted ? colors.textSecondary : colors.text, fontWeight: bold ? "700" : "400" }}>{children}</Text>;
}

type Tone = "red" | "amber" | "blue" | "green" | "gray";
const TONE: Record<Tone, [string, string]> = {
  red: [colors.dangerLight, colors.danger], amber: [colors.warningLight, colors.warning], blue: [colors.primaryLight, colors.primary],
  green: [colors.successLight, colors.success], gray: ["#F0F2F5", colors.textSecondary],
};

export function Pill({ tone, children, dashed }: { tone: Tone; children: ReactNode; dashed?: boolean }) {
  const [bg, fg] = TONE[tone];
  return (
    <View style={[styles.pill, dashed ? { backgroundColor: colors.card, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.muted } : { backgroundColor: bg }]}>
      <Text style={{ color: dashed ? colors.textSecondary : fg, fontWeight: "700", fontSize: 13 }}>{children}</Text>
    </View>
  );
}

const SEV: Record<Flag["severity"], Tone> = { critical: "red", warning: "amber", info: "gray", done: "green" };

/** Icon + text, never color alone. */
export function FlagPill({ flag }: { flag?: Flag }) {
  const { t } = useT();
  if (!flag) return <Pill tone="blue">● {t("flags.on_track")}</Pill>;
  const icon = flag.severity === "done" ? "✓" : flag.severity === "info" ? "ⓘ" : "⚠";
  return <Pill tone={SEV[flag.severity]}>{icon} {t(`flags.${flag.code}`)}</Pill>;
}

export function Banner({ tone, children }: { tone: "amber" | "red"; children: ReactNode }) {
  const [bg, fg] = TONE[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={tone === "amber" ? "cloud-offline-outline" : "alert-circle-outline"} size={20} color={fg} />
      <Text style={{ flex: 1, color: fg, fontSize: 14.5 }}>{children}</Text>
    </View>
  );
}

/** Timestamp/error state shared by all report screens, including retained data. */
export function DataFreshness({ data, error, fetchedAt, offline, onRetry }: { data: unknown; error: unknown; fetchedAt: Date | null; offline: boolean; onRetry: () => void }) {
  const { t, lang } = useT();
  const time = fetchedAt?.toLocaleString(lang === "vi" ? "vi-VN" : "en-GB") ?? "";
  return <>
    {data != null && fetchedAt && <Body muted size={13}>{t("common.asOf", { time })}</Body>}
    {offline && <Banner tone="amber">{data != null ? t("mobile.offline", { time }) : t("mobile.offlineNoData")}</Banner>}
    {error != null && <ErrorBox error={error} onRetry={onRetry} />}
  </>;
}

export function Loading() {
  return <View style={{ padding: 32 }}><ActivityIndicator color={colors.primary} /></View>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useT();
  return (
    <Card>
      <Body>{errorMessage(t, error)}</Body>
      <Button label={t("common.retry")} onPress={onRetry} tone="outline" />
    </Card>
  );
}

export function Button({ label, onPress, tone = "primary", busy, testID }: { label: string; onPress: () => void; tone?: "primary" | "outline"; busy?: boolean; testID?: string }) {
  const primary = tone === "primary";
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress}
      style={({ pressed }) => [styles.button, primary ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border }, pressed && { opacity: 0.85 }]}>
      {busy ? <ActivityIndicator color={primary ? "#fff" : colors.primary} /> : <Text style={{ color: primary ? "#fff" : colors.text, fontSize: 16, fontWeight: "700" }}>{label}</Text>}
    </Pressable>
  );
}

/** The text box every form uses (same look as the quick note and password screens). */
export const inputStyle = { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card } as const;

/** A labelled text field; the label is read with the box, the hint or error under it. */
export function Field({ id, label, required, hint, error, ...input }: { id: string; label: string; required?: boolean; hint?: string; error?: string } & Omit<TextInputProps, "style">) {
  return (
    <View style={{ gap: 6 }}>
      <Text nativeID={`${id}-label`} style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{label}{required ? " *" : ""}</Text>
      <TextInput testID={id} accessibilityLabelledBy={`${id}-label`} {...input}
        style={[inputStyle, error ? { borderColor: colors.danger } : null, input.multiline ? { minHeight: 72, textAlignVertical: "top" } : null]} />
      {error ? <Text style={{ fontSize: 13.5, color: colors.danger }}>{error}</Text> : hint ? <Text style={{ fontSize: 13, color: colors.muted }}>{hint}</Text> : null}
    </View>
  );
}

/** A labelled choice that opens into a list of rows (the quick note's customer picker, as a field). */
export function ChoiceList<T extends string>({ id, label, value, options, onChange }: { id: string; label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value)?.label ?? "";
  return (
    <View style={{ gap: 6 }}>
      <Text nativeID={`${id}-label`} style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{label}</Text>
      <Pressable testID={id} accessibilityRole="button" accessibilityLabel={`${label}: ${current}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={[inputStyle, { flexDirection: "row", alignItems: "center", minHeight: 46 }]}>
        <Text style={{ flex: 1, fontSize: 16, color: colors.text }} numberOfLines={1}>{current}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open && options.map((o) => (
        <Pressable key={o.value || "none"} testID={`${id}-${o.value || "none"}`} accessibilityRole="button" accessibilityState={{ selected: o.value === value }}
          onPress={() => { onChange(o.value); setOpen(false); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingLeft: 8 }}>
          <Ionicons name={o.value === value ? "checkmark" : "ellipse-outline"} size={16} color={o.value === value ? colors.primary : colors.border} />
          <Body>{o.label}</Body>
        </Pressable>
      ))}
    </View>
  );
}

/** Floating action button on a home screen; several stack upwards with `index`. */
export function Fab({ icon, label, onPress, index = 0, testID }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; index?: number; testID?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress}
      style={[styles.fab, { bottom: 16 + index * 64 }]}>
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Thin bar: delivered (dark) and received-not-delivered (light). Display only. */
export function Progress({ delivered, received, total }: { delivered: string; received: string; total: string }) {
  const w = Number(total) || 1;
  const d = Math.min(1, Number(delivered) / w);
  const r = Math.max(0, Math.min(1, Number(received) / w) - d);
  return (
    <View style={{ flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", backgroundColor: colors.border }}>
      <View style={{ width: `${d * 100}%`, backgroundColor: colors.primary }} />
      <View style={{ width: `${r * 100}%`, backgroundColor: "#90CAF9" }} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 8, shadowColor: "#0F172A", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 6 },
  pill: { alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  banner: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 12 },
  fab: { position: "absolute", right: 16, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.primary, paddingHorizontal: 20, minHeight: 52, borderRadius: 26, elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
