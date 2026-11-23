import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../../../lib/i18n";
import { useSession } from "../../../lib/session";
import { homeIsToday, showsOrdersTab } from "../../../lib/roles";
import { colors } from "../../../components/ui";

/** At most 4 tabs (5.8.1); a tab the user may not use is not built (href: null). */
export default function TabLayout() {
  const { t } = useT();
  const { can, me } = useSession();
  // "Today" (own tasks, drafts, awaited goods) is for people who sell; whole-company roles get the
  // company overview and the Orders tab. Matches the home screen's choice in (tabs)/index.tsx.
  const sales = !!me && homeIsToday(me.user.roles) && can("contracts.read");
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarLabelStyle: { fontSize: 12, fontWeight: "700" },
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.divider },
    }}>
      <Tabs.Screen name="index" options={{ title: sales ? t("mobile.today") : t("mobile.tabs.overview"), tabBarButtonTestID: "tab-overview", tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? "home" : "home-outline"} size={24} color={color} /> }} />
      <Tabs.Screen name="contracts" options={{ title: t("mobile.tabs.contracts"), tabBarButtonTestID: "tab-contracts", tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? "document-text" : "document-text-outline"} size={24} color={color} />, href: can("contracts.read") ? undefined : null }} />
      <Tabs.Screen name="orders" options={{ title: t("mobile.tabs.orders"), tabBarButtonTestID: "tab-orders", tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? "cube" : "cube-outline"} size={24} color={color} />, href: !!me && showsOrdersTab(me.user.roles) && can("contracts.read") ? undefined : null }} />
      <Tabs.Screen name="account" options={{ title: t("mobile.tabs.account"), tabBarButtonTestID: "tab-account", tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} /> }} />
    </Tabs>
  );
}
