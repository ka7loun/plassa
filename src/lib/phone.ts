// Tunisian phone numbers: 8 digits after +216. Accepts "22 123 456",
// "+216 22 123 456", "00216 22123456"; stores "+21622123456".
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s.\-()]/g, "");
  const m = digits.match(/^(?:\+216|00216|216)?(\d{8})$/);
  return m ? `+216${m[1]}` : null;
}

/** "+21622123456" -> "+216 22 123 456" */
export function formatPhone(e164: string | null | undefined): string {
  const m = e164?.match(/^\+216(\d{2})(\d{3})(\d{3})$/);
  return m ? `+216 ${m[1]} ${m[2]} ${m[3]}` : (e164 ?? "");
}
