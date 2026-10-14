import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avtoklub",
  description: "Avtoklub layihəsinin rəsmi saytı",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="az">
      <body>{children}</body>
    </html>
  );
}
