import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ads Monitor",
  description: "Google Ads Campaign Performance Monitor",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  );
}
