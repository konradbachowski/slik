"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface CodeInputProps {
  onComplete: (code: string) => void;
  disabled?: boolean;
}

const CODE_LENGTH = 6;

export default function CodeInput({
  onComplete,
  disabled = false,
}: CodeInputProps) {
  const [digits, setDigits] = useState<string[]>(
    Array(CODE_LENGTH).fill("")
  );
  const [bouncingIndex, setBouncingIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    if (!disabled) {
      const timeout = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 120);
      return () => clearTimeout(timeout);
    }
  }, [disabled]);

  const triggerBounce = useCallback((index: number) => {
    setBouncingIndex(index);
    setTimeout(() => setBouncingIndex(null), 280);
  }, []);

  const handleChange = useCallback(
    (index: number, value: string) => {
      if (disabled) return;

      const digit = value.replace(/\D/g, "").slice(-1);
      if (!digit) return;

      const newDigits = [...digits];
      newDigits[index] = digit;
      setDigits(newDigits);
      triggerBounce(index);

      // Check if complete
      const code = newDigits.join("");
      if (code.length === CODE_LENGTH && !newDigits.includes("")) {
        onComplete(code);
        return;
      }

      // Auto-advance
      if (index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, disabled, onComplete, triggerBounce]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      if (e.key === "Backspace") {
        e.preventDefault();
        const newDigits = [...digits];

        if (digits[index]) {
          newDigits[index] = "";
          setDigits(newDigits);
        } else if (index > 0) {
          newDigits[index - 1] = "";
          setDigits(newDigits);
          inputRefs.current[index - 1]?.focus();
        }
      }

      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1]?.focus();
      }

      if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits, disabled]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (disabled) return;
      e.preventDefault();

      const pasted = e.clipboardData
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, CODE_LENGTH);
      if (!pasted) return;

      const newDigits = Array(CODE_LENGTH).fill("");
      for (let i = 0; i < pasted.length; i++) {
        newDigits[i] = pasted[i];
        triggerBounce(i);
      }
      setDigits(newDigits);

      const nextEmpty = newDigits.findIndex((d) => d === "");
      const focusIndex = nextEmpty === -1 ? CODE_LENGTH - 1 : nextEmpty;
      inputRefs.current[focusIndex]?.focus();

      const code = newDigits.join("");
      if (code.length === CODE_LENGTH && !newDigits.includes("")) {
        onComplete(code);
      }
    },
    [disabled, onComplete, triggerBounce]
  );

  return (
    <div
      className="flex flex-col items-center w-full"
      style={{ animation: "fade-in-up 0.35s ease-out both" }}
    >
      <div
        className="flex gap-2.5 justify-center"
        role="group"
        aria-label="6-digit payment code"
      >
        {digits.map((digit, index) => {
          const isFilled = digit !== "";
          const isBouncing = bouncingIndex === index;

          return (
            <div
              key={index}
              className="relative"
              style={{
                transform: isBouncing ? "scale(1.12)" : "scale(1)",
                transition:
                  "transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              <input
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                disabled={disabled}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-16 text-center text-2xl font-bold outline-none caret-transparent select-none"
                style={{
                  fontFamily: "var(--font-code)",
                  borderRadius: "var(--radius-digit)",
                  backgroundColor: isFilled
                    ? "rgba(99, 91, 255, 0.04)"
                    : "var(--bg-card)",
                  color: isFilled ? "var(--text)" : "transparent",
                  border: `2px solid ${
                    isFilled ? "var(--primary)" : "var(--border)"
                  }`,
                  transition:
                    "border-color 0.2s ease, background-color 0.2s ease",
                  opacity: disabled ? 0.4 : 1,
                }}
                aria-label={`Digit ${index + 1} of ${CODE_LENGTH}`}
              />

              {/* Blinking cursor when empty */}
              {!isFilled && !disabled && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div
                    className="w-0.5 h-6 rounded-full"
                    style={{
                      backgroundColor: "var(--primary)",
                      animation:
                        "status-blink 1s ease-in-out infinite",
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p
        className="mt-4 text-sm tracking-wide"
        style={{
          fontFamily: "var(--font-code)",
          color: "var(--text-secondary)",
        }}
      >
        Enter the customer&apos;s 6-digit code
      </p>
    </div>
  );
}
