import { useState } from "react";
import { Text, TextInput } from "react-native";
import { Redirect, Stack } from "expo-router";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { useT } from "../../lib/i18n";
import { errorMessage } from "../../lib/errors";
import { Banner, Body, Button, Card, Loading, Screen, Title, colors } from "../../components/ui";

/** A password an admin set is temporary: the person chooses their own before anything else. */
function PasswordChangeRequired() {
  const { t } = useT();
  const { logout, refresh } = useSession();
  const [v, setV] = useState({ current: "", next: "", repeat: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = { borderWidth: 1, borderColor: "#BDBDBD", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card } as const;
  const save = async () => {
    if (v.next !== v.repeat) { setError(t("account.mismatch")); return; }
    setBusy(true); setError(null);
    try {
      await api("/me/password", { method: "POST", body: { current_password: v.current, new_password: v.next } });
      await refresh();
    } catch (e) {
      setError(errorMessage(t, e)); setBusy(false);
    }
  };
  const field = (id: keyof typeof v, label: string) => <>
    <Text nativeID={`pw-${id}-label`} style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>{label}</Text>
    <TextInput testID={`pw-${id}`} accessibilityLabelledBy={`pw-${id}-label`} secureTextEntry autoCapitalize="none" value={v[id]} onChangeText={(x) => setV({ ...v, [id]: x })} style={input} />
  </>;
  return (
    <Screen>
      <Title>{t("invite.mustChangeTitle")}</Title>
      <Card>
        <Body>{t("mobile.mustChange")}</Body>
        {error && <Banner tone="red">{error}</Banner>}
        {field("current", t("invite.temporary"))}
        {field("next", t("account.new"))}
        <Body muted size={13}>{t("account.hint")}</Body>
        {field("repeat", t("account.repeat"))}
        <Button testID="pw-save" label={t("invite.save")} busy={busy} onPress={() => void save()} />
      </Card>
      <Button testID="sign-out" label={t("nav.signOut")} tone="outline" onPress={() => void logout()} />
    </Screen>
  );
}

/** Production requires admins to turn on two-step sign-in, which is set up on the web. */
function TwoStepRequired() {
  const { t } = useT();
  const { logout } = useSession();
  return (
    <Screen>
      <Card><Body>{t("mobile.twoStepRequired")}</Body></Card>
      <Button testID="sign-out" label={t("nav.signOut")} tone="outline" onPress={() => void logout()} />
    </Screen>
  );
}

/** Every signed-in screen; deep links without a session go to login. */
export default function AppLayout() {
  const { me, ready } = useSession();
  // Screens mount only once the saved session is loaded, so their first requests carry the token.
  if (!ready) return <Loading />;
  if (!me) return <Redirect href="/login" />;
  if (me.user.password_change_required) return <PasswordChangeRequired />;
  if (me.user.mfa_enrollment_required) return <TwoStepRequired />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
