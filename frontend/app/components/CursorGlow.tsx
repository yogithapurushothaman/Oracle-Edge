"use client";

import React, { useEffect } from "react";

/**
 * Haptic Vibration Trigger
 * Fires hardware vibration if supported on device (mobile/tablet/gamepad).
 */
export const triggerHaptic = (pattern: number[] = [30, 20, 30]) => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignored if device lacks vibrator or user has not interacted
    }
  }
};

import { useTheme } from "../context/ThemeContext";

/**
 * CursorGlow - Screen-Wide Viewport Ambient Spotlight
 * Tracks mouse position via passive window listener and sets --mouse-x and --mouse-y
 * custom CSS variables on document.documentElement using requestAnimationFrame.
 */
export default function CursorGlow() {
  const { theme } = useTheme();

  useEffect(() => {
    let animationFrameId: number;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    // Set initial coordinates
    document.documentElement.style.setProperty("--mouse-x", `${targetX}px`);
    document.documentElement.style.setProperty("--mouse-y", `${targetY}px`);

    const handleMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const updateCssVariables = () => {
      // Linear interpolation for silky 60/120fps tracking
      currentX += (targetX - currentX) * 0.22;
      currentY += (targetY - currentY) * 0.22;

      document.documentElement.style.setProperty("--mouse-x", `${currentX.toFixed(1)}px`);
      document.documentElement.style.setProperty("--mouse-y", `${currentY.toFixed(1)}px`);

      animationFrameId = requestAnimationFrame(updateCssVariables);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animationFrameId = requestAnimationFrame(updateCssVariables);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const isDark = theme === "dark";
  const glowOpacity = isDark ? "rgba(14, 165, 233, 0.15)" : "rgba(14, 165, 233, 0.08)";

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
      style={{
        background: `radial-gradient(600px circle at var(--mouse-x, 50vw) var(--mouse-y, 50vh), ${glowOpacity}, transparent 80%)`,
      }}
      aria-hidden="true"
    />
  );
}

