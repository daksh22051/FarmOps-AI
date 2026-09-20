import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppClientProvider } from "../components/app-provider";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FarmOps AI — Autonomous Farm-to-Field Advisory",
  description: "Farm monitoring and advisory workspace",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <AppClientProvider>{children}</AppClientProvider>
      </body>
    </html>
  );
}
