import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";
import { useT } from "../../lib/i18n";
import { Body, Button, Card, Loading, Screen } from "../../components/ui";

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
  if (me.user.mfa_enrollment_required) return <TwoStepRequired />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
