import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";
import DualVideoBackground from "./components/DualVideoBackground";

export const metadata: Metadata = {
  title: "ORACLE EDGE | Space-to-Ground Infrastructure Decision Intelligence",
  description:
    "Municipal decision-support and action-prioritization system fusing Sentinel-2 satellite NDWI, weather data, and real-time ESP32 edge telemetry.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 1. Google Font: Plus Jakarta Sans (300, 400, 500, 600, 800) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;800&display=block"
          rel="stylesheet"
        />
        {/* 2. Google Font: Inter (400, 500, 600, 700) */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* 3. BubbledotICG-FinePos (Display / Retro Dot-Matrix) */}
        <link
          href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos"
          rel="stylesheet"
        />
        {/* 4. Font Awesome 6.5.2 */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A=="
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col text-white antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden bg-transparent">
        {/* Dual-Video Seamless Loop Engine + Optical Contrast Shield */}
        <DualVideoBackground />

        {/* Main UI layer */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <ThemeProvider>{children}</ThemeProvider>
        </div>
      </body>
    </html>
  );
}
