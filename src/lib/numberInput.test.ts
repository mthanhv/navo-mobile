import { editNumber, groupNumber, numberMarks, type NumberMarks } from "./numberInput";

// The full typing rules are tested in navo/src/lib/numberInput.test.ts (same file); this covers how
// NumberField drives it: a phone's number pad types and deletes at the end.
function pad(marks: NumberMarks, keys: string) {
  let state: ReturnType<typeof editNumber> = { value: "", text: "", pending: false, caret: 0 };
  for (const key of keys) {
    const before = state.text;
    const text = key === "<" ? before.slice(0, -1) : before + key;
    const next = editNumber({ text, caret: text.length, from: key === "<" ? text.length : before.length, before, inputType: key === "<" ? "deleteContentBackward" : "insertText",
      pending: state.pending, marked: state.marked, padDecimal: state.padDecimal }, marks);
    if (!next.ignored) state = next;
  }
  return state;
}

const vi = numberMarks("vi"), en = numberMarks("en");

test("amounts group as they are typed", () => {
  expect(pad(vi, "1250000").text).toBe("1.250.000");
  expect(pad(en, "1250000").text).toBe("1,250,000");
  expect(pad(vi, "1250,5").value).toBe("1250.5");
  expect(pad(vi, "10.5").value).toBe("10.5");
});

test("deleting at the end never turns grouping into decimals", () => {
  expect(pad(vi, "12500<")).toMatchObject({ text: "1.250", value: "1250" });
});

test("what the form keeps reads back with the language's marks", () => {
  expect(groupNumber(pad(vi, "10.5").value!, vi)).toBe("10,5");
});
