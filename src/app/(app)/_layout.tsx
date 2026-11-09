import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";
import { Loading } from "../../components/ui";

/** Every signed-in screen; deep links without a session go to login. */
export default function AppLayout() {
  const { me, ready } = useSession();
  // Screens mount only once the saved session is loaded, so their first requests carry the token.
  if (!ready) return <Loading />;
  if (!me) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
