"use client";

import React from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4";

export default function DualVideoBackground() {
  return (
    <div className="fixed inset-0 w-full h-full -z-50 overflow-hidden bg-black pointer-events-none">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full min-h-full w-auto h-auto object-cover opacity-85"
      >
        <source src={VIDEO_URL} type="video/mp4" />
      </video>
      {/* Thin legibility scrim to keep text legible while letting the video glow clearly through */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#030a14]/40 via-transparent to-[#030a14]/70 pointer-events-none" />
    </div>
  );
}
