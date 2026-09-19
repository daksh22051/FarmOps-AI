import type { Metadata } from "next";
import "./globals.css";
import { AppClientProvider } from "../components/app-provider";

export const metadata: Metadata = {
  title: "FarmOps AI",
  description: "Farm monitoring and advisory workspace",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppClientProvider>{children}</AppClientProvider>
      </body>
    </html>
  );
}
