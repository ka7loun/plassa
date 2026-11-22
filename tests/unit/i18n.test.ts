import { describe, expect, it } from "vitest";
import { DICTS, dirOf, fill, LOCALES } from "@/i18n";

type Tree = { [k: string]: string | string[] | Tree };

function flatten(t: Tree, prefix = ""): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string" || Array.isArray(v)) out[key] = v;
    else Object.assign(out, flatten(v, key));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const en = flatten(DICTS.en as unknown as Tree);

  for (const l of LOCALES) {
    const d = flatten(DICTS[l] as unknown as Tree);
    it(`${l} has exactly the same keys as en`, () => {
      expect(Object.keys(d).sort()).toEqual(Object.keys(en).sort());
    });
    it(`${l} has no empty strings and keeps every placeholder`, () => {
      for (const [k, v] of Object.entries(d)) {
        if (Array.isArray(v)) {
          expect(v.length, k).toBe((en[k] as string[]).length);
          continue;
        }
        expect(v.trim().length, k).toBeGreaterThan(0);
        expect(placeholders(v), k).toEqual(placeholders(en[k] as string));
      }
    });
  }

  it("uses right-to-left only for Arabic", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(dirOf("fr")).toBe("ltr");
  });

  it("fills placeholders", () => {
    expect(fill("{a} free of {n}", { a: 3, n: 10 })).toBe("3 free of 10");
    expect(fill("{missing}")).toBe("{missing}");
  });
});
