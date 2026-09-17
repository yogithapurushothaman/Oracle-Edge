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
        {/* 1. Google Font Inter */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* 2. BubbledotICG-FinePos (Display / Retro Dot-Matrix) */}
        <link
          href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos"
          rel="stylesheet"
        />
        {/* 3. Font Awesome 6.5.2 */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A=="
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans text-white antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden">
        {/* 1. Full-viewport cover video behind all UI */}
        <div className="fixed inset-0 w-full h-full overflow-hidden bg-black -z-20 pointer-events-none">
          <video
            className="w-full h-full object-cover opacity-90 pointer-events-none"
            autoPlay
            muted
            loop
            playsInline
          >
            <source
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
              type="video/mp4"
            />
          </video>
        </div>

        {/* 2. Lightened Ambient Radial Scrim (Video Details Show Through) */}
        <div
          className="legibility-shield fixed inset-0 pointer-events-none -z-10"
          style={{
            background:
              "radial-gradient(circle at 50% 15%, rgba(15, 43, 72, 0.25) 0%, rgba(8, 22, 40, 0.45) 50%, rgba(3, 10, 20, 0.7) 100%)",
          }}
        />

        {/* 3. Main UI layer above shield */}
        <div className="relative z-10 min-h-screen flex flex-col">
          <ThemeProvider>{children}</ThemeProvider>
        </div>
      </body>
    </html>
  );
}
