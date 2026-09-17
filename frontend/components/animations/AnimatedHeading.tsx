"use client";

import React, { useEffect, useState } from "react";

interface AnimatedHeadingProps {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "div";
}

export default function AnimatedHeading({
  text,
  className = "",
  as: Component = "h1",
}: AnimatedHeadingProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  const lines = text.split("\n");

  return (
    <Component className={className}>
      {lines.map((line, lineIndex) => {
        const chars = Array.from(line);
        return (
          <span key={lineIndex} className="inline-block whitespace-nowrap">
            {chars.map((char, charIndex) => {
              const delay = lineIndex * line.length * 30 + charIndex * 30 + 200;
              return (
                <span
                  key={charIndex}
                  className="inline-block transition-all duration-500 ease-out"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? "translateX(0)" : "translateX(-18px)",
                    transitionDelay: `${delay}ms`,
                  }}
                >
                  {char === " " ? "\u00A0" : char}
                </span>
              );
            })}
            {lineIndex < lines.length - 1 && <br />}
          </span>
        );
      })}
    </Component>
  );
}
