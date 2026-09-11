import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DWS Research",
  description: "A research workspace for architectural inquiry, references, boards, and project knowledge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
