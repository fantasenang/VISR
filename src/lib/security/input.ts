const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const ZERO_WIDTH_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;
const BIDI_OVERRIDE_CHARACTERS = /[\u202A-\u202E\u2066-\u2069]/g;
const ANGLE_BRACKETS = /[<>]/g;
const MULTISPACE = /[ \t]+/g;

export function sanitizePlainText(value: string) {
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(BIDI_OVERRIDE_CHARACTERS, "")
    .replace(ANGLE_BRACKETS, "")
    .replace(MULTISPACE, " ")
    .trim();
}

export function sanitizeMultilineText(value: string) {
  return value
    .normalize("NFKC")
    .replace(CONTROL_CHARACTERS, "")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(BIDI_OVERRIDE_CHARACTERS, "")
    .replace(ANGLE_BRACKETS, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(MULTISPACE, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
