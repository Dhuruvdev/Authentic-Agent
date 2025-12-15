import { useEffect, useState, useRef, useCallback } from "react";
import { motion, useInView } from "framer-motion";

interface DecryptedTextProps {
  text: string;
  speed?: number;
  maxIterations?: number;
  sequential?: boolean;
  revealDirection?: "start" | "end" | "center";
  useOriginalCharsOnly?: boolean;
  className?: string;
  parentClassName?: string;
  encryptedClassName?: string;
  animateOn?: "view" | "hover" | "both";
}

const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

export function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = "start",
  useOriginalCharsOnly = false,
  className = "",
  parentClassName = "",
  encryptedClassName = "",
  animateOn = "view",
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.5 });

  const getRandomChar = useCallback(() => {
    if (useOriginalCharsOnly) {
      return text[Math.floor(Math.random() * text.length)];
    }
    return characters[Math.floor(Math.random() * characters.length)];
  }, [text, useOriginalCharsOnly]);

  const animate = useCallback(() => {
    if (isAnimating) return;
    setIsAnimating(true);
    setHasAnimated(true);

    let currentIteration = 0;
    const textLength = text.length;
    const revealedIndices = new Set<number>();

    const getNextIndex = () => {
      const remaining = [];
      for (let i = 0; i < textLength; i++) {
        if (!revealedIndices.has(i)) remaining.push(i);
      }
      if (remaining.length === 0) return -1;

      if (revealDirection === "start") {
        return Math.min(...remaining);
      } else if (revealDirection === "end") {
        return Math.max(...remaining);
      } else {
        const center = Math.floor(textLength / 2);
        return remaining.sort((a, b) => Math.abs(a - center) - Math.abs(b - center))[0];
      }
    };

    const interval = setInterval(() => {
      if (sequential) {
        const nextIdx = getNextIndex();
        if (nextIdx !== -1) {
          revealedIndices.add(nextIdx);
        }
      }

      setDisplayText(
        text
          .split("")
          .map((char, idx) => {
            if (char === " ") return " ";
            if (sequential && revealedIndices.has(idx)) return char;
            if (!sequential && currentIteration >= maxIterations) return char;
            return getRandomChar();
          })
          .join("")
      );

      currentIteration++;

      const shouldStop = sequential
        ? revealedIndices.size >= textLength
        : currentIteration >= maxIterations;

      if (shouldStop) {
        clearInterval(interval);
        setDisplayText(text);
        setIsAnimating(false);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed, maxIterations, sequential, revealDirection, getRandomChar, isAnimating]);

  useEffect(() => {
    if (animateOn === "view" && isInView && !hasAnimated) {
      animate();
    }
  }, [isInView, animateOn, hasAnimated, animate]);

  const handleMouseEnter = () => {
    if ((animateOn === "hover" || animateOn === "both") && !isAnimating) {
      animate();
    }
  };

  return (
    <motion.span
      ref={containerRef}
      className={`inline-block ${parentClassName}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText.split("").map((char, idx) => {
        const isRevealed = char === text[idx];
        return (
          <span
            key={idx}
            className={isRevealed ? className : encryptedClassName}
          >
            {char}
          </span>
        );
      })}
    </motion.span>
  );
}
