import type { Metadata } from "next";
import { Albert_Sans, Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });
const albert = Albert_Sans({ variable: "--font-albert", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TS Academy Submit",
  description: "Assignment and capstone submissions for TS Academy, checked before they are sent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${albert.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
