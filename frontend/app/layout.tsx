import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./context/ThemeContext";

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
      <body className="min-h-full flex flex-col text-white antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden bg-transparent is-loaded">
        {/* Fail-safe, hardware-accelerated video background structure */}
        <div className="fixed inset-0 w-full h-full -z-50 overflow-hidden bg-black pointer-events-none">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-cover opacity-85"
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4"
              type="video/mp4"
            />
          </video>
          {/* Thin legibility scrim to keep text legible while letting the video glow clearly through */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#030a14]/40 via-transparent to-[#030a14]/70 pointer-events-none" />
        </div>

        {/* Main UI layer */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <ThemeProvider>{children}</ThemeProvider>
        </div>
      </body>
    </html>
  );
}
