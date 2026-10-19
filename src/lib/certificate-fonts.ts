import { Cormorant_Garamond, Great_Vibes, Montserrat, Playfair_Display } from "next/font/google";

// The fonts a certificate can use for the name and the date. They are loaded with the page so the browser can draw them on the picture.
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });
const vibes = Great_Vibes({ subsets: ["latin"], weight: "400", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export type FontKey = "cormorant" | "playfair" | "vibes" | "montserrat";

export const CERT_FONTS: { key: FontKey; label: string; family: string; bold: boolean }[] = [
  { key: "cormorant", label: "Cormorant Garamond (classic)", family: cormorant.style.fontFamily, bold: true },
  { key: "playfair", label: "Playfair Display (elegant)", family: playfair.style.fontFamily, bold: true },
  { key: "vibes", label: "Great Vibes (script)", family: vibes.style.fontFamily, bold: false },
  { key: "montserrat", label: "Montserrat (clean)", family: montserrat.style.fontFamily, bold: true },
];

// Put this on a wrapper so the font files are loaded on the page.
export const CERT_FONT_CLASS = [cormorant, playfair, vibes, montserrat].map((f) => f.className).join(" ");
