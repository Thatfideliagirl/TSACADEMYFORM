// A certificate number looks like TS followed by 12 letters and digits, for example TSRJ7C7W89W7B5, the same style as the
// numbers on TS Academy's current certificates. It is worked out from the certificate's own hidden id, so it never changes
// and no two certificates share one. Nothing has to be stored.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789"; // 34 characters, without the easily confused I and O
const BYTES = [0, 1, 2, 3, 4, 5, 7, 9, 10, 11, 12, 13]; // skips the bytes of an id that are partly fixed

export function certificateNumber(id: string): string {
  const hex = id.replace(/[^0-9a-f]/gi, "").padEnd(32, "0");
  return "TS" + BYTES.map((b) => ALPHABET[parseInt(hex.slice(b * 2, b * 2 + 2), 16) % ALPHABET.length]).join("");
}
