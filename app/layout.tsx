import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
});

export const metadata: Metadata = {
  title: "قطّع الجبنة بالنص! | هيما فارم",
  description:
    "لعبة من هيما فارم: الموس بيتحرك لوحده.. وكله عشان تقطّع الجبنة نصين بالظبط!",
};

export const viewport: Viewport = {
  themeColor: "#14563d",
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} h-full antialiased`}>
      <body className="min-h-full bg-cream font-sans text-brand-dark">
        {children}
      </body>
    </html>
  );
}
