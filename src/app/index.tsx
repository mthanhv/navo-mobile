import { Redirect } from "expo-router";
import { useSession } from "../lib/session";
import { Loading } from "../components/ui";

export default function Index() {
  const { me, ready } = useSession();
  if (!ready) return <Loading />;
  return <Redirect href={me ? "/(app)/(tabs)" : "/login"} />;
}
