import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "3Dimg — AI-Powered 2D to 3D Asset Generator",
  description:
    "Transform any 2D image into a high-quality 3D asset through AI-guided conversation. Powered by AntiGravity Multi-Agent technology.",
  keywords: ["3D generation", "AI", "2D to 3D", "3D assets", "game development"],
  authors: [{ name: "AntiGravity" }],
  openGraph: {
    title: "3Dimg — AI-Powered 2D to 3D Asset Generator",
    description: "Transform any 2D image into a high-quality 3D asset through AI conversation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
