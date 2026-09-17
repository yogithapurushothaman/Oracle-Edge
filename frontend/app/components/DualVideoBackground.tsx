"use client";

import React, { useEffect } from "react";

const VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260912_104036_bd6924f6-3c8e-417e-8465-6d03c8c2e9e6.mp4";
const POSTER_URL =
  "https://d2ol7oe51mr4n9.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/82e7eb75-c65f-490a-99b5-f3d1cad54200.webp";

export default function DualVideoBackground() {
  useEffect(() => {
    // 1. Timed Entrance Orchestration: trigger .is-loaded when fonts ready or safety fallback
    const triggerEntrance = () => {
      requestAnimationFrame(() => {
        document.body.classList.add("is-loaded");
      });
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(triggerEntrance).catch(triggerEntrance);
    } else {
      window.addEventListener("load", triggerEntrance);
    }
    const safetyTimer = setTimeout(triggerEntrance, 1200);

    // 2. Seamless Dual-Video Crossfade Engine
    // Alternates Video A & Video B at the 9.05s mark (duration ~10.04s) to prevent continent snap
    const videoA = document.getElementById("bgVideoA") as HTMLVideoElement | null;
    const videoB = document.getElementById("bgVideoB") as HTMLVideoElement | null;
    let animId: number;

    if (videoA && videoB) {
      let currentActive = videoA;
      let nextPending = videoB;
      let isSwitching = false;

      const startPlayback = () => {
        videoA.play().catch(() => {});
      };
      startPlayback();
      window.addEventListener("touchstart", startPlayback, { once: true });
      window.addEventListener("click", startPlayback, { once: true });

      const checkCrossfade = () => {
        if (currentActive && currentActive.currentTime > 0) {
          const dur = currentActive.duration || 10.04;
          const threshold = dur - 0.95;

          if (currentActive.currentTime >= threshold && !isSwitching) {
            isSwitching = true;
            nextPending.currentTime = 0;
            const playPromise = nextPending.play();

            if (playPromise !== undefined) {
              playPromise
                .then(() => {
                  nextPending.classList.add("is-active");
                  currentActive.classList.remove("is-active");

                  setTimeout(() => {
                    const temp = currentActive;
                    currentActive = nextPending;
                    nextPending = temp;
                    isSwitching = false;
                  }, 920);
                })
                .catch(() => {
                  isSwitching = false;
                });
            }
          }
        }
        animId = requestAnimationFrame(checkCrossfade);
      };

      animId = requestAnimationFrame(checkCrossfade);
    }

    return () => {
      clearTimeout(safetyTimer);
      if (animId) cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <>
      {/* Seamless Dual-Video Container */}
      <div className="bg" aria-hidden="true">
        <video
          className="bg-video is-active"
          id="bgVideoA"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER_URL}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
        <video
          className="bg-video"
          id="bgVideoB"
          muted
          loop
          playsInline
          preload="auto"
          poster={POSTER_URL}
        >
          <source src={VIDEO_URL} type="video/mp4" />
        </video>
      </div>

      {/* Optical Contrast Scrim Shield (Preserves 100% Data Legibility) */}
      <div className="optical-contrast-shield" aria-hidden="true" />
    </>
  );
}
