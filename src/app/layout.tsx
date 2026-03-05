import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spotify DJ",
  description: "DJ your Spotify playlists with visualizer effects",
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
