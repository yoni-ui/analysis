import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TACTICAL_VANGUARD // AI_DEFENSE_SIM",
  description:
    "Educational browser simulation of missile defense scenarios. Not real-world defense tooling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${spaceGrotesk.variable} ${inter.variable}`}>
      <body className="bg-surface text-on-surface font-body overflow-hidden antialiased selection:bg-primary selection:text-on-primary">
        {children}
      </body>
    </html>
  );
}
