import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ORACLE Edge | Space-to-Ground Infrastructure Decision Intelligence",
  description: "Decision-support and action-prioritization system fusing Sentinel-2 satellite NDWI, weather data, and real-time ESP32 edge telemetry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col control-room-bg">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
