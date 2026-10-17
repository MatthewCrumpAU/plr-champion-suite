import type { Metadata, Viewport } from "next";
import "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PLR Champion Software Suite", template: "%s · PLR Champion" },
  description: "Private PLR editing, design, product, research, marketing and profit tools.",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1122",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
