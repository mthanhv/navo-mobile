import { Redirect, Stack } from "expo-router";
import { useSession } from "../../lib/session";

/** Every signed-in screen; deep links without a session go to login. */
export default function AppLayout() {
  const { me, ready } = useSession();
  if (ready && !me) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
