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

/** The long side a card is sent and kept at: legible print, a small upload on a weak signal. */
const LONG_SIDE = 1600;

/** A JPEG copy of the photo at most LONG_SIDE pixels on its long side (iPhones shoot HEIC, which the reader refuses). */
export async function shrinkCard(photo: LocalFile): Promise<LocalFile> {
  const original = await ImageManipulator.manipulate(photo.uri).renderAsync();
  const image = Math.max(original.width, original.height) > LONG_SIDE
    ? await ImageManipulator.manipulate(photo.uri).resize(original.width >= original.height ? { width: LONG_SIDE } : { height: LONG_SIDE }).renderAsync()
    : original;
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  return { uri: saved.uri, name: "danh-thiep.jpg", type: "image/jpeg" };
}

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
 * overwritten. Returns the new form and how many fields it filled. A card with no company name
 * (a sole trader) names the lead after the person.
 */
export function fillFromCard(form: LeadForm, card: Card): { form: LeadForm; filled: number } {
  let filled = 0;
  const pick = (current: string, read: string | null | undefined) => {
    if (current.trim() || !read?.trim()) return current;
    filled++;
    return read.trim();
  };
  const next: LeadForm = {
    ...form,
    name: pick(form.name, card.company_name ?? card.person.full_name),
    tax_code: pick(form.tax_code, card.tax_code),
    address: pick(form.address, card.address),
    website: pick(form.website, card.website),
    phone: pick(form.phone, card.company_phone),
    contact: {
      full_name: pick(form.contact.full_name, card.person.full_name),
      job_title: pick(form.contact.job_title, card.person.job_title),
      phone: pick(form.contact.phone, card.person.phone),
      email: pick(form.contact.email, card.person.email),
    },
  };
  return { form: next, filled };
}
