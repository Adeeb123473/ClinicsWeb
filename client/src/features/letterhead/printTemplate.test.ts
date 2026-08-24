import { describe, expect, it } from "vitest";
import { renderTemplatePages, type LetterheadTemplate } from "./printTemplate";
import type { LetterheadField } from "./fields";

const base = (over: Partial<LetterheadTemplate> = {}): LetterheadTemplate => ({
  mode: "OVERLAY",
  globalOffsetMm: { x: 0, y: 0 },
  status: "CALIBRATED",
  fields: [],
  letterheadImageUrl: "/api/v1/doctors/abc/letterhead/image/dewarped",
  ...over,
});

const f = (over: Partial<LetterheadField> & Pick<LetterheadField, "key">): LetterheadField => ({
  xMm: 40,
  yMm: 62,
  ...over,
});

describe("OVERLAY mode", () => {
  it("prints only the field values — never the letterhead image", () => {
    const html = renderTemplatePages(base({ fields: [f({ key: "patientName" })] }), {
      patientName: "Muhammad Ahmed",
    }).join("");

    expect(html).toContain("Muhammad Ahmed");
    // The stored image is an alignment backdrop for the editor only. If it ever reaches the
    // printer it would print on top of the doctor's own pre-printed pad.
    expect(html).not.toContain("<img");
    expect(html).not.toContain("letterhead/image");
  });

  it("positions fields in millimetres, not pixels or percentages", () => {
    const html = renderTemplatePages(base({ fields: [f({ key: "age", xMm: 170, yMm: 62.5 })] }), {
      age: "42",
    }).join("");
    expect(html).toContain("left:170mm");
    expect(html).toContain("top:62.5mm");
    expect(html).not.toMatch(/left:\d+px/);
    expect(html).not.toMatch(/left:\d+%/);
  });

  it("applies the global calibration offset to every field", () => {
    const html = renderTemplatePages(
      base({ globalOffsetMm: { x: 1.5, y: -2 }, fields: [f({ key: "age", xMm: 100, yMm: 50 })] }),
      { age: "42" },
    ).join("");
    expect(html).toContain("left:101.5mm");
    expect(html).toContain("top:48mm");
  });

  it("escapes values so a patient name cannot inject markup", () => {
    const html = renderTemplatePages(base({ fields: [f({ key: "patientName" })] }), {
      patientName: "<script>alert(1)</script>",
    }).join("");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an inlined field into its host's box, not its own", () => {
    const html = renderTemplatePages(
      base({
        fields: [f({ key: "patientName", xMm: 40, yMm: 62 }), f({ key: "gender", inlineWith: "patientName", prefix: " / " })],
      }),
      { patientName: "Muhammad Ahmed", gender: "M" },
    ).join("");

    expect(html).toContain("Muhammad Ahmed / M");
    // Exactly one positioned box, because gender does not get one.
    expect(html.match(/position:absolute/g) ?? []).toHaveLength(1);
  });

  it("emits nothing for a template with no values", () => {
    const html = renderTemplatePages(base({ fields: [f({ key: "patientName" })] }), {}).join("");
    expect(html.trim()).toBe("");
  });
});

describe("FULL mode", () => {
  it("renders the letterhead image as a full-page background", () => {
    const html = renderTemplatePages(base({ mode: "FULL", fields: [f({ key: "patientName" })] }), {
      patientName: "Muhammad Ahmed",
    }).join("");

    expect(html).toContain("<img");
    expect(html).toContain("letterhead/image/dewarped");
    expect(html).toContain("width:210mm");
    expect(html).toContain("height:297mm");
    expect(html).toContain("Muhammad Ahmed");
  });

  it("falls back to no background when no image has been uploaded", () => {
    const html = renderTemplatePages(
      base({ mode: "FULL", letterheadImageUrl: null, fields: [f({ key: "patientName" })] }),
      { patientName: "X" },
    ).join("");
    expect(html).not.toContain("<img");
  });
});

describe("consultation body overflow", () => {
  it("keeps a short body on one page", () => {
    const pages = renderTemplatePages(
      base({ fields: [f({ key: "consultationBody", xMm: 30, yMm: 90, widthMm: 150, heightMm: 150 })] }),
      { consultationBody: "Tab. Paracetamol 500mg TDS x 5 days" },
    );
    expect(pages).toHaveLength(1);
  });

  it("overflows a long body onto a second page and repeats the header fields", () => {
    const long = Array.from({ length: 600 }, (_, i) => `word${i}`).join(" ");
    const pages = renderTemplatePages(
      base({
        fields: [
          f({ key: "patientName", xMm: 40, yMm: 62 }),
          f({ key: "consultationBody", xMm: 30, yMm: 90, widthMm: 150, heightMm: 40 }),
        ],
      }),
      { patientName: "Muhammad Ahmed", consultationBody: long },
    );

    expect(pages.length).toBeGreaterThan(1);
    // A loose continuation sheet still identifies the patient.
    for (const page of pages) expect(page).toContain("Muhammad Ahmed");
  });
});
