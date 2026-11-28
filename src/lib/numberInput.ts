// Reading and grouping a number while a person types it (NumberField in components/ui.tsx; the same file as navo/src/lib/numberInput.ts).
// Ported from the Lova app so both apps type numbers the same way. Self-contained (no imports).
//
// A plain value is "-1250000.5", never grouped. Forms keep the text in the language's marks
// ("1.250.000,5" in Vietnamese) and read it with parseDecimalInput (lib/format.ts).
export interface NumberMarks {
  group: string;
  decimal: string;
}

/** 1,250,000.5 in English, 1.250.000,5 in Vietnamese: as formatMoney shows amounts. */
export function numberMarks(language: string | undefined): NumberMarks {
  return language?.startsWith("en") ? { group: ",", decimal: "." } : { group: ".", decimal: "," };
}

/** plain with its thousands grouped; what follows the decimal mark stays as typed. Text that is no plain number is left as it is. */
export function groupNumber(plain: string, { group, decimal }: NumberMarks): string {
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(plain);
  if (!match) return plain;
  const [, sign, whole, fraction] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return `${sign}${grouped}${fraction === undefined ? "" : decimal + fraction}`;
}

export interface TypedNumber {
  /** The plain value; null when the text can't be read. */
  value: string | null;
  /** The text to show. */
  text: string;
  /**
   * The text holds a mark that isn't settled yet ("10." may become 10.5 or
   * 10.500), so it is shown as typed and read whole on the next edit.
   */
  pending: boolean;
  /** The person typed or pasted a mark, so the marks in the text are not only the box's own. */
  marked?: boolean;
  /** A mark key after digits the box grouped itself: the group mark may start decimals (1250.5). */
  padDecimal?: boolean;
}

/** Digits, or digits grouped in threes by mark ("1.250.000"). */
function isWhole(text: string, mark: string): boolean {
  if (/^\d+$/.test(text)) return true;
  const [head, ...rest] = text.split(mark);
  return rest.length > 0 && /^[1-9]\d{0,2}$/.test(head) && rest.every((part) => /^\d{3}$/.test(part));
}

function withoutLeadingZeros(plain: string): string {
  return plain.replace(/^(-?)0+(?=\d)/, "$1");
}

/** A number in the language's own marks: every group mark is grouping. */
export function readFormatted(text: string, marks: NumberMarks): TypedNumber {
  const plain = text.split(marks.group).join("").replace(marks.decimal, ".");
  if (plain === "") return { value: "", text: "", pending: false };
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(plain)) return { value: null, text, pending: false };
  const shown = withoutLeadingZeros(plain);
  return { value: shown.replace(/\.$/, "").replace(/^(-?)\./, "$10."), text: groupNumber(shown, marks), pending: false };
}

/**
 * A number with marks a person typed or pasted. The language's decimal mark
 * is a decimal. The other mark groups thousands when three digits follow it
 * (1.250 in Vietnamese is 1250) and is a decimal otherwise (10.5 is ten and
 * a half, as a number pad types it). A whole amount has no decimals, so
 * either mark groups.
 *
 * Repeated group marks only group ("5.000.00" is refused), unless padDecimal
 * says the box put the earlier ones there.
 */
export function readTyped(raw: string, marks: NumberMarks, whole = false, padDecimal = false): TypedNumber {
  const amount = raw.trim().replace(/^₫\s*|\s*₫$/g, "");
  // Spaces can only part thousands: "5 000 00" is no number.
  if (/\s/.test(amount) && !/^-?[1-9]\d{0,2}(\s\d{3})+([.,]\d+)?$/.test(amount)) return { value: null, text: raw, pending: true };
  const text = amount.replace(/\s/g, "");
  const sign = text.startsWith("-") ? "-" : "";
  const body = text.slice(sign.length);
  const { group, decimal } = marks;
  const unread: TypedNumber = { value: null, text: raw, pending: true };
  const settled = (plain: string): TypedNumber => readFormatted(sign + plain.replace(".", decimal), marks);
  const typing = (plain: string): TypedNumber => ({ value: withoutLeadingZeros(sign + plain), text, pending: true });

  if (!body) return sign ? unread : settled("");
  if (/^\d+$/.test(body)) return settled(body);
  if (/[^\d.,]/.test(body)) return unread;

  if (whole) {
    // Either mark, or both: "12,000.000" while typing dots in English.
    if (isWhole(body.replace(/,/g, "."), ".")) return settled(body.replace(/[.,]/g, ""));
    // Still typing the next group: "12." or "12.0".
    return unread;
  }

  const lastGroup = body.lastIndexOf(group);
  const lastDecimal = body.lastIndexOf(decimal);
  if (lastDecimal >= 0) {
    const decimals = body.split(decimal).length - 1;
    if (lastGroup > lastDecimal) {
      // The other language's marks: 12.000,50 pasted into English.
      const head = body.slice(0, lastGroup);
      const tail = body.slice(lastGroup + 1);
      return !head.includes(group) && isWhole(head, decimal) && /^\d+$/.test(tail) ? settled(`${head.split(decimal).join("")}.${tail}`) : unread;
    }
    if (decimals === 1) {
      const head = body.slice(0, lastDecimal);
      const tail = body.slice(lastDecimal + 1);
      if (!/^\d*$/.test(tail) || (head && !isWhole(head, group)) || (!head && !tail)) return unread;
      return settled(`${head.split(group).join("")}.${tail}`);
    }
    // Repeated, it can only group: 12.000.000 pasted into English.
    return lastGroup < 0 && isWhole(body, decimal) ? settled(body.split(decimal).join("")) : unread;
  }

  if (isWhole(body, group)) return settled(body.split(group).join(""));
  const head = body.slice(0, lastGroup);
  const tail = body.slice(lastGroup + 1);
  if (!isWhole(head, group) || !/^\d*$/.test(tail)) return unread;
  if (head.includes(group) && !padDecimal) return unread;
  const int = head.split(group).join("");
  return typing(tail ? `${int}.${tail}` : int);
}

export interface NumberEdit {
  text: string;
  /** The caret after the edit. */
  caret: number;
  /** What the edit replaced: its start in the text before. Unknown when the browser didn't say (autofill). */
  from?: number;
  before: string;
  /** The input event's type (deleteContentBackward, insertFromPaste…). */
  inputType?: string;
  /** The text before was still pending. */
  pending?: boolean;
  /** As the edit before returned them. */
  marked?: boolean;
  padDecimal?: boolean;
}

/**
 * What an edit leaves in the box: the value, the text and the caret. A key
 * that can't be part of a number leaves the box as it was, as a number box
 * does; pasted text is kept, to be refused with a message, never stripped.
 */
export function editNumber(edit: NumberEdit, marks: NumberMarks, whole = false): TypedNumber & { caret: number; ignored?: boolean } {
  const { caret, before, pending, inputType = "" } = edit;
  let { text } = edit;
  let at = caret;
  const { group } = marks;
  const from = edit.from === undefined ? 0 : Math.min(edit.from, caret);
  const inserted = inputType.startsWith("delete") ? "" : text.slice(from, caret);

  if (!inputType.includes("Paste") && inserted.length === 1) {
    const misplacedSign = inserted === "-" && (caret !== 1 || text.indexOf("-", 1) >= 0);
    const secondDecimal = !whole && !pending && inserted === marks.decimal && before.includes(marks.decimal)
      && text.split(marks.decimal).length > 2 && !isWhole(before, marks.decimal);
    if (!/[\d.,-]/.test(inserted) || misplacedSign || secondDecimal) {
      return { value: null, text: before, pending: !!pending, caret: caret - 1, ignored: true };
    }
  }

  // Deleting a group mark deletes the digit beside it, else nothing would change.
  if (!pending && inputType.startsWith("deleteContent") && before.length === text.length + 1
      && before[caret] === group && before.slice(0, caret) + before.slice(caret + 1) === text) {
    if (inputType === "deleteContentForward") text = text.slice(0, caret) + text.slice(caret + 1);
    else if (caret > 0) {
      text = text.slice(0, caret - 1) + text.slice(caret);
      at = caret - 1;
    }
  }

  const typedKey = !inputType.includes("Paste") && inserted.length <= 1;
  const padDecimal = typedKey && (pending ? !!edit.padDecimal : !edit.marked && inserted === group && caret === text.length);
  const marked = text !== "" && (!!edit.marked || /[.,]/.test(inserted));
  const parsed = pending || /[^\d-]/.test(inserted) ? readTyped(text, marks, whole, padDecimal) : readFormatted(text, marks);
  const read = { ...parsed, marked, padDecimal };
  if (read.value === null || read.text === text) return { ...read, caret: at };

  // The caret keeps the same digits to its right.
  const right = text.slice(at).split(group).join("").length;
  let next = read.text.length;
  for (let seen = 0; next > 0 && seen < right; next--) {
    if (read.text[next - 1] !== group) seen++;
  }
  return { ...read, caret: next };
}
