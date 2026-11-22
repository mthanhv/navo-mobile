import { useState } from "react";
import { View } from "react-native";
import { useApi } from "../lib/useApi";
import { useT } from "../lib/i18n";
import { formatDate } from "../lib/format";
import type { Note } from "../lib/types";
import { Body, Button, Card, DataFreshness, ErrorBox, Loading, colors } from "./ui";

const FIRST = 3;

/** What was noted at this customer before, shown while writing the next note. */
export function EarlierNotes({ customerId }: { customerId: string }) {
  const { t, lang } = useT();
  const notes = useApi<Note[]>(`/notes?customer_id=${customerId}`);
  const [all, setAll] = useState(false);
  const list = notes.data ?? [];
  return (
    <Card>
      <Body bold>{t("fieldNotes.title")}{list.length > 0 ? ` (${list.length})` : ""}</Body>
      <DataFreshness {...notes} onRetry={notes.reload} />
      {notes.loading && !notes.data && <Loading />}
      {notes.error != null && !notes.data && <ErrorBox error={notes.error} onRetry={notes.reload} />}
      {notes.data?.length === 0 && <Body muted>{t("fieldNotes.empty")}</Body>}
      {(all ? list : list.slice(0, FIRST)).map((note) => (
        <View key={note.id} style={{ borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 10, gap: 4 }}>
          <Body muted size={13}>
            {[note.author, new Date(note.written_at).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB"), note.contract_id ? (note.contract_number ?? t("fieldNotes.draftContract")) : ""].filter(Boolean).join(" · ")}
          </Body>
          <Body size={16}>{note.body}</Body>
          {note.tasks.map((task) => (
            <Body key={task.id} muted>
              {[`${t("fieldNotes.next")}: ${task.title}`, task.due_on ? formatDate(task.due_on) : "", task.done_at ? t("fieldNotes.done") : ""].filter(Boolean).join(" · ")}
            </Body>
          ))}
        </View>
      ))}
      {list.length > FIRST && <Button tone="outline" label={all ? t("fieldNotes.fewer") : t("fieldNotes.all", { count: list.length })} onPress={() => setAll(!all)} testID="notes-show-all" />}
    </Card>
  );
}
