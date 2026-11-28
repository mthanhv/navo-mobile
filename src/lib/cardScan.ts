import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { upload, type LocalFile } from "./api";

/** What navo-api read from a business card (POST /ai/card-read); null where not printed. */
export type Card = {
  company_name: string | null; tax_code: string | null; address: string | null; website: string | null; company_phone: string | null;
  person: { full_name: string | null; job_title: string | null; phone: string | null; email: string | null };
};

/** The lead form on the phone: the web drawer's fields plus one contact person. */
export type LeadForm = {
  name: string; tax_code: string; address: string; website: string; phone: string;
  industry: string; source: string; interest: string; estimated_value: string;
  contact: { full_name: string; job_title: string; phone: string; email: string };
};

export const emptyLeadForm = (): LeadForm => ({
  name: "", tax_code: "", address: "", website: "", phone: "", industry: "", source: "", interest: "", estimated_value: "",
  contact: { full_name: "", job_title: "", phone: "", email: "" },
});

/** The long side a photo is sent at to be read: legible print, a small upload on a weak signal. */
const READ_SIDE = 1600;
/** The long side a photo is kept at on the record: sharp enough to check every number later. */
const KEEP_SIDE = 3000;

/** A JPEG copy at most longSide pixels on its long side (iPhones shoot HEIC, which the API refuses). */
async function jpegCopy(photo: LocalFile, name: string, longSide: number, compress: number): Promise<LocalFile> {
  const original = await ImageManipulator.manipulate(photo.uri).renderAsync();
  const image = Math.max(original.width, original.height) > longSide
    ? await ImageManipulator.manipulate(photo.uri).resize(original.width >= original.height ? { width: longSide } : { height: longSide }).renderAsync()
    : original;
  const saved = await image.saveAsync({ compress, format: SaveFormat.JPEG });
  return { uri: saved.uri, name, type: "image/jpeg" };
}

/** The copy sent to be read. */
export const shrinkPhoto = (photo: LocalFile, name: string) => jpegCopy(photo, name, READ_SIDE, 0.7);

/** The copy attached to the record (as Lova keeps the receipt itself, not the copy that was read). */
export const keepablePhoto = (photo: LocalFile, name: string) => jpegCopy(photo, name, KEEP_SIDE, 0.8);

/** A business card photo, shrunk. */
export const shrinkCard = (photo: LocalFile) => shrinkPhoto(photo, "danh-thiep.jpg");

/** Asks navo-api to read the card. Throws ApiError when it can't; the person then types the values. */
export function readCard(photo: LocalFile): Promise<Card> {
  return upload<Card>("/ai/card-read", {}, photo);
}

/** True when the card gave at least one value. */
export function cardHasValues(card: Card): boolean {
  return [card.company_name, card.tax_code, card.address, card.website, card.company_phone, ...Object.values(card.person)].some((v) => !!v?.trim());
}

/**
 * Fills only the fields that are still empty, so nothing typed while the card was being read is
 * overwritten. Returns the new form and the fields it filled ("name", "contact.phone"…), which the
 * form marks for checking. A card with no company name
 * (a sole trader) names the lead after the person.
 */
export function fillFromCard(form: LeadForm, card: Card): { form: LeadForm; filled: string[] } {
  const filled: string[] = [];
  const pick = (key: string, current: string, read: string | null | undefined) => {
    if (current.trim() || !read?.trim()) return current;
    filled.push(key);
    return read.trim();
  };
  const next: LeadForm = {
    ...form,
    name: pick("name", form.name, card.company_name ?? card.person.full_name),
    tax_code: pick("tax_code", form.tax_code, card.tax_code),
    address: pick("address", form.address, card.address),
    website: pick("website", form.website, card.website),
    phone: pick("phone", form.phone, card.company_phone),
    contact: {
      full_name: pick("contact.full_name", form.contact.full_name, card.person.full_name),
      job_title: pick("contact.job_title", form.contact.job_title, card.person.job_title),
      phone: pick("contact.phone", form.contact.phone, card.person.phone),
      email: pick("contact.email", form.contact.email, card.person.email),
    },
  };
  return { form: next, filled };
}
