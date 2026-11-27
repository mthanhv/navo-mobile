import { useT } from "../lib/i18n";
import type { Trip, TripStatus } from "../lib/types";
import { Pill, type Tone } from "./ui";

const TONE: Record<TripStatus, Tone> = { draft: "gray", advance_pending: "amber", in_progress: "blue", settlement_pending: "amber", approved: "green", closed: "gray", cancelled: "gray" };

/** A trip's state, worded as on the web (trips.status.*). */
export function TripPill({ trip }: { trip: Trip }) {
  const { t } = useT();
  return <Pill tone={TONE[trip.status]}>{t(`trips.status.${trip.status}`)}</Pill>;
}
