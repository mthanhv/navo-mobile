import type { LocalFile } from "../lib/api";
import { cardHasValues, readCard, type Card as CardReading } from "../lib/cardScan";
import { ScanDocument } from "./ScanDocument";

/** Scan a business card into the new-lead form (texts scanCard.*). */
export function ScanCard({ photo, onPhoto, onReading }: { photo: LocalFile | null; onPhoto: (p: LocalFile | null) => void; onReading: (card: CardReading) => number }) {
  return <ScanDocument texts="scanCard" fileName="danh-thiep.jpg" testPrefix="card" photo={photo} onPhoto={onPhoto} read={readCard} hasValues={cardHasValues} onReading={onReading} />;
}
