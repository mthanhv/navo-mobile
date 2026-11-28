import { Platform } from "react-native";
import Constants from "expo-constants";
import { router } from "expo-router";
import { api } from "./api";

/**
 * Phone push for reminders (planned work, the weekly report). The native module only exists in
 * builds made after it was added, so everything here is loaded lazily and fails quietly: an older
 * build, a simulator, or a person who said no to notifications simply gets reminders in the app,
 * by email and on Zalo instead.
 */
type Notifications = typeof import("expo-notifications");
let mod: Notifications | null | undefined;
let token: string | null = null;

async function load(): Promise<Notifications | null> {
  if (mod !== undefined) return mod;
  try {
    mod = await import("expo-notifications");
    mod.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }) });
    // Tapping a reminder opens where it belongs.
    mod.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as { type?: string } | undefined;
      if (data?.type === "weekly_report" || data?.type === "weekly_team") router.push("/(app)/week");
      else router.push("/(app)/(tabs)");
    });
  } catch {
    mod = null;
  }
  return mod;
}

/** Ask (once) to send notifications and register this phone for the signed-in person. */
export async function registerForPush(): Promise<boolean> {
  const n = await load();
  if (!n) return false;
  try {
    const Device = await import("expo-device");
    if (!Device.isDevice) return false;
    let { status } = await n.getPermissionsAsync();
    if (status !== "granted") status = (await n.requestPermissionsAsync()).status;
    if (status !== "granted") return false;
    if (Platform.OS === "android") {
      await n.setNotificationChannelAsync("reminders", { name: "Nhắc việc", importance: n.AndroidImportance.HIGH });
    }
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    const t = await n.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    token = t.data;
    await api("/me/push-tokens", { method: "POST", body: { token: t.data, platform: Platform.OS === "ios" ? "ios" : "android" } });
    return true;
  } catch {
    return false;
  }
}

/** On sign-out this phone stops receiving the person's reminders. */
export async function unregisterPush(): Promise<void> {
  if (!token) return;
  const t = token;
  token = null;
  await api(`/me/push-tokens/${encodeURIComponent(t)}`, { method: "DELETE" }).catch(() => undefined);
}
