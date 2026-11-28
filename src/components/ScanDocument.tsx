import { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, type LocalFile } from "../lib/api";
import { keepablePhoto, shrinkPhoto } from "../lib/cardScan";
import { errorMessage } from "../lib/errors";
import { useT } from "../lib/i18n";
import { Body, Card, PhotoButton, colors } from "./ui";

type Status = "idle" | "reading" | "filled" | "kept" | "nothing" | "offline" | "failed";

/**
 * Scan a document at the top of a form, after Lova Driver's "Scan receipt": one button takes the
 * photo (or chooses one from the phone) and attaches it at once, then, with signal and when the
 * server reads documents (`canRead`), has it read; the reading fills only fields still empty
 * (onReading returns how many) and the form marks them for checking. "Attach photo only" keeps the
 * photo without reading. Without reading only the attach button shows, so the photo is still kept.
 * Whatever happens the person can type. Texts come from `texts` (scanCard.*, scanReceipt.*).
 */
export function ScanDocument<R>({ texts, fileName, photo, onPhoto, read, hasValues, onReading, testPrefix, canRead }: {
  texts: string; fileName: string; photo: LocalFile | null; onPhoto: (p: LocalFile | null) => void; canRead: boolean;
  read: (photo: LocalFile) => Promise<R>; hasValues: (r: R) => boolean; onReading: (r: R) => number; testPrefix: string;
}) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");
  // The form's newest callback, so what is typed while the photo is read is not overwritten.
  const latest = useRef(onReading);
  useEffect(() => { latest.current = onReading; }, [onReading]);

  const take = async (fromLibrary: boolean, reading: boolean) => {
    const perm = fromLibrary ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const res = fromLibrary
      ? await ImagePicker.launchImageLibraryAsync({ quality: 0.9, mediaTypes: ["images"] })
      : await ImagePicker.launchCameraAsync({ quality: 0.9, mediaTypes: ["images"] });
    if (res.canceled) return;
    const a = res.assets[0];
    const original: LocalFile = { uri: a.uri, name: a.fileName ?? fileName, type: a.mimeType ?? "image/jpeg" };
    let kept: LocalFile;
    try {
      kept = await keepablePhoto(original, fileName);
    } catch (e) {
      setFailure(errorMessage(t, e)); setStatus("failed");
      return;
    }
    onPhoto(kept);
    if (!reading) { setStatus("idle"); return; }
    if ((await NetInfo.fetch()).isConnected === false) { setStatus("offline"); return; }
    setStatus("reading");
    try {
      const result = await read(await shrinkPhoto(original, fileName));
      if (!hasValues(result)) { setStatus("nothing"); return; }
      setStatus(latest.current(result) > 0 ? "filled" : "kept");
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) { setStatus("offline"); return; }
      setFailure(errorMessage(t, e)); setStatus("failed");
    }
  };

  const reading = status === "reading";
  const tone = status === "filled" ? colors.primary : status === "failed" || status === "offline" || status === "nothing" ? colors.warning : colors.textSecondary;
  return (
    <Card style={{ backgroundColor: colors.primaryLight }}>
      <Body size={14}>{t(canRead ? `${texts}.intro` : `${texts}.introAttach`)}</Body>
      {photo && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image testID={`${testPrefix}-photo`} source={{ uri: photo.uri }} accessibilityLabel={t(`${texts}.photo`)} style={{ width: 120, height: 72, borderRadius: 8, backgroundColor: colors.card }} resizeMode="cover" />
          {!reading && (
            <Pressable accessibilityRole="button" testID={`${testPrefix}-remove`} onPress={() => { onPhoto(null); setStatus("idle"); }} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>{t(`${texts}.remove`)}</Text>
            </Pressable>
          )}
        </View>
      )}
      {canRead ? (
        <View style={{ gap: 2 }}>
          <PhotoButton testID={`${testPrefix}-scan`} icon="scan-outline" label={t(`${texts}.button`)} busy={reading} onPick={(lib) => void take(lib, true)} />
          <PhotoButton testID={`${testPrefix}-attach`} tone="ghost" icon="attach-outline" label={t("scan.attachOnly")} disabled={reading} onPick={(lib) => void take(lib, false)} />
        </View>
      ) : (
        <PhotoButton testID={`${testPrefix}-attach`} tone="outline" icon="attach-outline" label={t(photo ? `${texts}.replace` : `${texts}.attach`)} onPick={(lib) => void take(lib, false)} />
      )}
      {status !== "idle" && (
        <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Ionicons name={status === "filled" || status === "kept" ? "checkmark-circle-outline" : status === "reading" ? "hourglass-outline" : "alert-circle-outline"} size={18} color={tone} style={{ marginTop: 1 }} />
          <Text testID={`${testPrefix}-status`} style={{ flex: 1, fontSize: 14.5, color: tone }}>
            {status === "failed" ? `${failure} ${t(`${texts}.failed`)}` : t(`${texts}.${status}`)}
          </Text>
        </View>
      )}
    </Card>
  );
}
