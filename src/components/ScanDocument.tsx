import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, type LocalFile } from "../lib/api";
import { shrinkPhoto } from "../lib/cardScan";
import { errorMessage } from "../lib/errors";
import { useT } from "../lib/i18n";
import { Body, Button, Card, colors } from "./ui";

type Status = "idle" | "reading" | "filled" | "kept" | "nothing" | "offline" | "failed";

/**
 * Photograph a document and let navo-api read it (after Lova Driver's receipt scan): the photo is
 * kept at once, then read; the reading fills only fields still empty (onReading returns how
 * many). A failed or offline read never blocks typing. Texts come from `texts` (scanCard.*,
 * scanReceipt.*): take, pick, intro, photo, remove, reading, filled, kept, nothing, offline, failed.
 */
export function ScanDocument<R>({ texts, fileName, photo, onPhoto, read, hasValues, onReading, testPrefix }: {
  texts: string; fileName: string; photo: LocalFile | null; onPhoto: (p: LocalFile | null) => void;
  read: (photo: LocalFile) => Promise<R>; hasValues: (r: R) => boolean; onReading: (r: R) => number; testPrefix: string;
}) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");
  // The form's newest callback, so what is typed while the photo is read is not overwritten.
  const latest = useRef(onReading);
  useEffect(() => { latest.current = onReading; }, [onReading]);

  const scan = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ["images"] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ["images"] });
    if (res.canceled) return;
    const a = res.assets[0];
    let shot: LocalFile;
    try {
      shot = await shrinkPhoto({ uri: a.uri, name: a.fileName ?? fileName, type: a.mimeType ?? "image/jpeg" }, fileName);
    } catch (e) {
      setFailure(errorMessage(t, e)); setStatus("failed");
      return;
    }
    onPhoto(shot);
    if ((await NetInfo.fetch()).isConnected === false) { setStatus("offline"); return; }
    setStatus("reading");
    try {
      const reading = await read(shot);
      if (!hasValues(reading)) { setStatus("nothing"); return; }
      setStatus(latest.current(reading) > 0 ? "filled" : "kept");
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) { setStatus("offline"); return; }
      setFailure(errorMessage(t, e)); setStatus("failed");
    }
  };

  const reading = status === "reading";
  const tone = status === "filled" ? colors.success : status === "failed" || status === "offline" || status === "nothing" ? colors.warning : colors.textSecondary;
  return (
    <Card style={{ backgroundColor: colors.primaryLight }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="scan-outline" size={22} color={colors.primary} />
        <Body bold>{t(`${texts}.take`)}</Body>
      </View>
      <Body size={14}>{t(`${texts}.intro`)}</Body>
      {photo && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={{ uri: photo.uri }} accessibilityLabel={t(`${texts}.photo`)} style={{ width: 120, height: 72, borderRadius: 8, backgroundColor: colors.card }} resizeMode="cover" />
          {!reading && (
            <Pressable accessibilityRole="button" testID={`${testPrefix}-remove`} onPress={() => { onPhoto(null); setStatus("idle"); }} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>{t(`${texts}.remove`)}</Text>
            </Pressable>
          )}
        </View>
      )}
      {reading ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
          <ActivityIndicator color={colors.primary} />
          <Body>{t(`${texts}.reading`)}</Body>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button label={t(`${texts}.take`)} onPress={() => void scan(true)} testID={`${testPrefix}-camera`} />
          <Button label={t(`${texts}.pick`)} tone="outline" onPress={() => void scan(false)} testID={`${testPrefix}-library`} />
        </View>
      )}
      {status !== "idle" && status !== "reading" && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Ionicons name={status === "filled" || status === "kept" ? "checkmark-circle-outline" : "alert-circle-outline"} size={18} color={tone} style={{ marginTop: 1 }} />
          <Text testID={`${testPrefix}-status`} style={{ flex: 1, fontSize: 14.5, color: tone }}>
            {status === "failed" ? `${failure} ${t(`${texts}.failed`)}` : t(`${texts}.${status}`)}
          </Text>
        </View>
      )}
    </Card>
  );
}
