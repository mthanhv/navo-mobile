import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "../lib/session";
import { useT } from "../lib/i18n";
import { errorMessage } from "../lib/errors";
import { ApiError } from "../lib/api";
import { Banner, Button, colors } from "../components/ui";

export default function Login() {
  const { t } = useT();
  const { me, login } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  // Asked for after the password is accepted on an account with two-step sign-in.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  if (me) return <Redirect href="/(app)/(tabs)" />;

  const submit = async () => {
    setTouched(true);
    if (!email.trim() || !password || (needsCode && !code.trim())) return;
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password, needsCode ? code.trim() : undefined);
    } catch (e) {
      if (e instanceof ApiError && e.reason === "mfa_required") {
        setNeedsCode(true);
        setTouched(false);
      } else {
        setError(errorMessage(t, e));
      }
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "center", padding: 20 }}>
        <View style={styles.card}>
          <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "800", color: colors.text }}>{t("login.title")}</Text>
          <Text style={{ fontSize: 15, color: colors.textSecondary }}>{t("login.subtitle")}</Text>
          {error && <Banner tone="red">{error}</Banner>}
          <Text style={styles.label}>{t("login.email")}</Text>
          <TextInput testID="login-email" accessibilityLabel={t("login.email")} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={[styles.input, touched && !email.trim() && styles.invalid]} />
          {touched && !email.trim() && <Text accessibilityLiveRegion="polite" style={styles.err}>{t("validation.required")}</Text>}
          <Text style={styles.label}>{t("login.password")}</Text>
          <TextInput testID="login-password" accessibilityLabel={t("login.password")} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} style={[styles.input, touched && !password && styles.invalid]} />
          {touched && !password && <Text accessibilityLiveRegion="polite" style={styles.err}>{t("validation.required")}</Text>}
          {needsCode && <>
            <Text style={styles.label}>{t("login.code")}</Text>
            <TextInput testID="login-code" accessibilityLabel={t("login.code")} value={code} onChangeText={setCode} autoFocus autoCapitalize="none" autoComplete="one-time-code" onSubmitEditing={submit} style={[styles.input, touched && !code.trim() && styles.invalid]} />
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>{t("login.codeHint")}</Text>
            {touched && !code.trim() && <Text accessibilityLiveRegion="polite" style={styles.err}>{t("validation.required")}</Text>}
          </>}
          <View style={{ height: 8 }} />
          <Button testID="login-submit" label={t("login.submit")} onPress={submit} busy={busy} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 20, padding: 20, gap: 8 },
  label: { fontSize: 15, fontWeight: "700", color: colors.text, marginTop: 8 },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: colors.text },
  invalid: { borderColor: colors.danger },
  err: { color: colors.danger, fontSize: 14 },
});
