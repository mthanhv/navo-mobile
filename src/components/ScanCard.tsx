import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import NetInfo from "@react-native-community/netinfo";
import { Ionicons } from "@expo/vector-icons";
import { ApiError, type LocalFile } from "../lib/api";
import { cardHasValues, readCard, shrinkCard, type Card as CardReading } from "../lib/cardScan";
import { errorMessage } from "../lib/errors";
import { useT } from "../lib/i18n";
import { Body, Button, Card, colors } from "./ui";

type Status = "idle" | "reading" | "filled" | "kept" | "nothing" | "offline" | "failed";

/**
 * Scan a business card (after Lova Driver's receipt scan): the photo is kept on the form at
 * once, then read by navo-api; the reading fills only fields still empty (onReading returns how
 * many). A failed read never blocks typing: the form works the same without it.
 */
export function ScanCard({ photo, onPhoto, onReading }: { photo: LocalFile | null; onPhoto: (p: LocalFile | null) => void; onReading: (card: CardReading) => number }) {
  const { t } = useT();
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");
  // The form's newest callback, so what is typed while the card is read is not overwritten.
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
    let card: LocalFile;
    try {
      card = await shrinkCard({ uri: a.uri, name: a.fileName ?? "danh-thiep.jpg", type: a.mimeType ?? "image/jpeg" });
    } catch (e) {
      setFailure(errorMessage(t, e)); setStatus("failed");
      return;
    }
    onPhoto(card);
    if ((await NetInfo.fetch()).isConnected === false) { setStatus("offline"); return; }
    setStatus("reading");
    try {
      const reading = await readCard(card);
      if (!cardHasValues(reading)) { setStatus("nothing"); return; }
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
        <Ionicons name="card-outline" size={22} color={colors.primary} />
        <Body bold>{t("scanCard.take")}</Body>
      </View>
      <Body size={14}>{t("scanCard.intro")}</Body>
      {photo && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Image source={{ uri: photo.uri }} accessibilityLabel={t("scanCard.photo")} style={{ width: 120, height: 72, borderRadius: 8, backgroundColor: colors.card }} resizeMode="cover" />
          {!reading && (
            <Pressable accessibilityRole="button" testID="card-remove" onPress={() => { onPhoto(null); setStatus("idle"); }} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ color: colors.primary, fontSize: 15, fontWeight: "600" }}>{t("scanCard.remove")}</Text>
            </Pressable>
          )}
        </View>
      )}
      {reading ? (
        <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 }}>
          <ActivityIndicator color={colors.primary} />
          <Body>{t("scanCard.reading")}</Body>
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Button label={t("scanCard.take")} onPress={() => void scan(true)} testID="card-camera" />
          <Button label={t("scanCard.pick")} tone="outline" onPress={() => void scan(false)} testID="card-library" />
        </View>
      )}
      {status !== "idle" && status !== "reading" && (
        <View accessibilityRole="alert" style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
          <Ionicons name={status === "filled" || status === "kept" ? "checkmark-circle-outline" : "alert-circle-outline"} size={18} color={tone} style={{ marginTop: 1 }} />
          <Text testID="card-status" style={{ flex: 1, fontSize: 14.5, color: tone }}>
            {status === "failed" ? `${failure} ${t("scanCard.failed")}` : t(`scanCard.${status}`)}
          </Text>
        </View>
      )}
    </Card>
  );
}
