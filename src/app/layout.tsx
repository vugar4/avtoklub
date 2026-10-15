import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import "@fontsource/noto-sans/400.css";
import "@fontsource/noto-sans/500.css";
import "@fontsource/noto-sans/600.css";
import "@fontsource/noto-sans/700.css";
import "@fontsource/noto-sans/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "avtoklub", template: "%s · avtoklub" },
  description: "Sənin avtomobilin. Sənin klubun. Sənin çevrən.",
  icons: { icon: "/photos/bmw-e39.jpg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="az"><body>{children}<Toaster position="top-right" richColors closeButton /></body></html>;
}
