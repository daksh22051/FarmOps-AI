import type { Metadata } from "next";
import "./globals.css";
import { AppClientProvider } from "../components/app-provider";

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
    <html lang="en">
      <body suppressHydrationWarning>
        <AppClientProvider>{children}</AppClientProvider>
      </body>
    </html>
  );
}
