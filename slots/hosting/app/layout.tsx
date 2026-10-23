import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gamboligy Studio",
  description: "Build, play and shape your slot studio with an AI assistant.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
