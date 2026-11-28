import type { LocalFile } from "../lib/api";
import { cardHasValues, readCard, type Card as CardReading } from "../lib/cardScan";
import { ScanDocument } from "./ScanDocument";

/** Scan a business card into the new-lead form (texts scanCard.*); without reading, the card photo is only attached. */
export function ScanCard({ photo, onPhoto, onReading, canRead }: { photo: LocalFile | null; onPhoto: (p: LocalFile | null) => void; onReading: (card: CardReading) => number; canRead: boolean }) {
  return <ScanDocument texts="scanCard" fileName="danh-thiep.jpg" testPrefix="card" photo={photo} onPhoto={onPhoto} read={readCard} hasValues={cardHasValues} onReading={onReading} canRead={canRead} />;
}
