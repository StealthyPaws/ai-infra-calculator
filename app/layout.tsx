import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Infra Calculator",
  description: "AI Video Analytics Infrastructure Calculator",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}