"use client";

import React, { useEffect, useState } from "react";

interface FadeInProps {
  children: React.ReactNode;
  delay?: number; // milliseconds
  duration?: number; // milliseconds
  className?: string;
}

export default function FadeIn({
  children,
  delay = 0,
  duration = 600,
  className = "",
}: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true);
    }, delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`transition-opacity ease-out ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transitionDuration: `${duration}ms`,
      }}
    >
      {children}
    </div>
  );
}
