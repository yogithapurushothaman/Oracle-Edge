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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-sans bg-black text-white antialiased selection:bg-white selection:text-black overflow-x-hidden relative">
        {/* Full-screen, fixed, background-anchored video with no dark overlays or dimming masks */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="fixed inset-0 w-full h-full object-cover -z-20 pointer-events-none"
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
