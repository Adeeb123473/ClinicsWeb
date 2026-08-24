import { describe, expect, it } from "vitest";
import {
  composeFields,
  formatFieldValue,
  offsetPosition,
  paginateBody,
  sampleValues,
  type LetterheadField,
} from "./fields";

const field = (over: Partial<LetterheadField> & Pick<LetterheadField, "key">): LetterheadField => ({
  xMm: 10,
  yMm: 10,
  ...over,
});

describe("formatFieldValue", () => {
  it("applies prefix, suffix and uppercase", () => {
    expect(formatFieldValue(field({ key: "age", prefix: "Age: " }), 42)).toBe("Age: 42");
    expect(formatFieldValue(field({ key: "age", suffix: " yrs" }), 42)).toBe("42 yrs");
    expect(formatFieldValue(field({ key: "patientName", uppercase: true }), "Muhammad Ahmed")).toBe("MUHAMMAD AHMED");
  });

  it("never prints a prefix on its own for an empty value", () => {
    // A pad would otherwise show a stray "Age:" with nothing after it.
    for (const empty of ["", "   ", null, undefined]) {
      expect(formatFieldValue(field({ key: "age", prefix: "Age: " }), empty)).toBe("");
    }
  });
});

describe("composeFields — inlineWith", () => {
  const values = { patientName: "Muhammad Ahmed", gender: "Male", age: "42" };

  it("appends an inlined field to its host instead of giving it a box", () => {
    const fields = [
      field({ key: "patientName", xMm: 40, yMm: 62 }),
      field({ key: "gender", inlineWith: "patientName", prefix: " / " }),
    ];
    const out = composeFields(fields, values);

    expect(out).toHaveLength(1);
    expect(out[0].field.key).toBe("patientName");
    expect(out[0].text).toBe("Muhammad Ahmed / Male");
  });

  it("supports the sample pad's case: gender as an initial after the name", () => {
    const fields = [
      field({ key: "patientName", xMm: 40, yMm: 62 }),
      field({ key: "gender", inlineWith: "patientName", prefix: " / " }),
    ];
    const out = composeFields(fields, { patientName: "Muhammad Ahmed", gender: "M" });
    expect(out[0].text).toBe("Muhammad Ahmed / M");
  });

  it("keeps standalone fields as their own boxes", () => {
    const fields = [
      field({ key: "patientName", xMm: 40, yMm: 62 }),
      field({ key: "age", xMm: 170, yMm: 62 }),
    ];
    const out = composeFields(fields, values);
    expect(out.map((r) => r.field.key)).toEqual(["patientName", "age"]);
    expect(out.map((r) => r.text)).toEqual(["Muhammad Ahmed", "42"]);
  });

  it("drops an inlined field whose host is missing or hidden", () => {
    const orphan = composeFields([field({ key: "gender", inlineWith: "patientName" })], values);
    expect(orphan).toHaveLength(0);

    const hiddenHost = composeFields(
      [
        field({ key: "patientName", visible: false }),
        field({ key: "gender", inlineWith: "patientName" }),
      ],
      values,
    );
    expect(hiddenHost).toHaveLength(0);
  });

  it("omits invisible fields entirely — the switch a pad with no gender blank uses", () => {
    const out = composeFields(
      [
        field({ key: "patientName", xMm: 40, yMm: 62 }),
        field({ key: "gender", xMm: 100, yMm: 62, visible: false }),
      ],
      values,
    );
    expect(out).toHaveLength(1);
    expect(out[0].field.key).toBe("patientName");
  });

  it("still prints a host that has no value of its own but has an inlined guest", () => {
    const out = composeFields(
      [
        field({ key: "patientName", xMm: 40, yMm: 62 }),
        field({ key: "gender", inlineWith: "patientName" }),
      ],
      { gender: "Male" },
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Male");
  });

  it("drops fields with no text at all rather than printing empty boxes", () => {
    const out = composeFields([field({ key: "patientName" }), field({ key: "age" })], {});
    expect(out).toHaveLength(0);
  });

  it("appends multiple guests to one host in field order", () => {
    const out = composeFields(
      [
        field({ key: "patientName", xMm: 40, yMm: 62 }),
        field({ key: "gender", inlineWith: "patientName", prefix: " / " }),
        field({ key: "age", inlineWith: "patientName", prefix: ", " , suffix: "y" }),
      ],
      values,
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe("Muhammad Ahmed / Male, 42y");
  });
});

describe("paginateBody", () => {
  it("returns nothing for empty text", () => {
    expect(paginateBody("", { widthMm: 100, heightMm: 50, fontSizePt: 11 })).toEqual([]);
    expect(paginateBody("   ", { widthMm: 100, heightMm: 50, fontSizePt: 11 })).toEqual([]);
  });

  it("keeps short text on a single page", () => {
    const pages = paginateBody("Short note", { widthMm: 120, heightMm: 100, fontSizePt: 11 });
    expect(pages).toHaveLength(1);
    expect(pages[0]).toBe("Short note");
  });

  it("overflows long text onto further pages", () => {
    const long = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const pages = paginateBody(long, { widthMm: 100, heightMm: 40, fontSizePt: 11 });
    expect(pages.length).toBeGreaterThan(1);
    // Nothing is lost in the split.
    expect(pages.join("\n").split(/\s+/).filter(Boolean)).toHaveLength(400);
  });

  it("fits more lines on a taller box", () => {
    const long = Array.from({ length: 200 }, (_, i) => `w${i}`).join(" ");
    const short = paginateBody(long, { widthMm: 100, heightMm: 30, fontSizePt: 11 });
    const tall = paginateBody(long, { widthMm: 100, heightMm: 200, fontSizePt: 11 });
    expect(tall.length).toBeLessThan(short.length);
  });
});

describe("offsetPosition", () => {
  it("shifts a field by the template's global calibration offset", () => {
    expect(offsetPosition(field({ key: "age", xMm: 100, yMm: 50 }), { x: 1.5, y: -2 })).toEqual({
      xMm: 101.5,
      yMm: 48,
    });
  });

  it("is a no-op at zero offset", () => {
    expect(offsetPosition(field({ key: "age", xMm: 100, yMm: 50 }), { x: 0, y: 0 })).toEqual({
      xMm: 100,
      yMm: 50,
    });
  });
});

describe("sampleValues", () => {
  it("supplies realistic text for every editable field", () => {
    const v = sampleValues(new Date("2026-08-24T00:00:00Z"));
    expect(v.patientName).toBe("Muhammad Ahmed");
    expect(v.age).toBe("42");
    expect(v.gender).toBe("Male");
    expect(String(v.date)).toMatch(/2026/);
  });
});
