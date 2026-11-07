import { View } from "react-native";
import { useSession } from "../../../lib/session";
import { useT } from "../../../lib/i18n";
import { API_URL } from "../../../lib/api";
import { Body, Button, Card, Screen, Title } from "../../../components/ui";

export default function AccountScreen() {
  const { t, lang, setLang } = useT();
  const { me, logout } = useSession();
  return (
    <Screen>
      <Title>{t("mobile.tabs.account")}</Title>
      <Card>
        <Body muted size={13.5}>{t("mobile.signedInAs")}</Body>
        <Body bold size={17}>{me?.user.full_name}</Body>
        <Body muted>{me?.user.email}</Body>
        <Body muted>{me?.user.roles.map((r) => t(`roles.${r}`)).join(", ")}</Body>
      </Card>
      <Card>
        <Body bold>{t("common.language")}</Body>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}><Button label="Tiếng Việt" tone={lang === "vi" ? "primary" : "outline"} onPress={() => setLang("vi")} /></View>
          <View style={{ flex: 1 }}><Button label="English" tone={lang === "en" ? "primary" : "outline"} onPress={() => setLang("en")} /></View>
        </View>
      </Card>
      <Card><Body muted size={13}>{t("mobile.apiServer")}: {API_URL}</Body></Card>
      <Button testID="sign-out" label={t("nav.signOut")} tone="outline" onPress={() => void logout()} />
    </Screen>
  );
}
