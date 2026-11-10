import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";
import type { Flag } from "../lib/types";

/** Tokens follow Lova Driver: slate neutrals, Lova blue, 16 px cards, large type for phones outdoors. */
export const colors = {
  primary: "#1565C0", primaryLight: "#EEF4FD", hero: "#0B1B33", text: "#0F172A", textSecondary: "#475467",
  muted: "#647187", border: "#E2E7EE", divider: "#E9EDF3", background: "#F1F4F8", card: "#FFFFFF",
  danger: "#B42318", dangerLight: "#FDEDEC", warning: "#8A4B00", warningLight: "#FEF5E6", success: "#15803D", successLight: "#E9F7EF",
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
  button: { minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
