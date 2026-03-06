"use client";

import { useRef } from "react";
import { hapticLight } from "@/lib/haptics";

const LENGTH = 6;

export function PasscodeDigits({
  value,
  onChange,
  onSubmit,
  loading = false,
  error = null,
  label = "Enter the 6-digit passcode to continue",
  submitLabel = "Continue",
  disabled = false,
  inputMode = "numeric",
  autoComplete = "one-time-code",
}: {
  value: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string | null;
  label?: string;
  submitLabel?: string;
  disabled?: boolean;
  inputMode?: "numeric" | "text";
  autoComplete?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const normalized = (inputMode === "numeric" ? value.replace(/\D/g, "") : value).slice(0, LENGTH);
  const digits = normalized.split("").concat(Array(Math.max(0, LENGTH - normalized.length)).fill(""));

  const setDigit = (index: number, char: string) => {
    const next = normalized.split("");
    next[index] = char;
    const joined = next.join("").slice(0, LENGTH);
    onChange(joined);
    hapticLight();
    if (char && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
    if (joined.length === LENGTH) {
      refs.current[LENGTH - 1]?.blur();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
      const next = normalized.split("");
      next[index - 1] = "";
      onChange(next.join(""));
      hapticLight();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = inputMode === "numeric"
      ? e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH)
      : e.clipboardData.getData("text").slice(0, LENGTH);
    if (pasted) {
      onChange(pasted);
      const focusIdx = Math.min(pasted.length, LENGTH - 1);
      refs.current[focusIdx]?.focus();
      hapticLight();
    }
  };

  return (
    <div className="w-full">
      <p className="font-body text-sm mb-4" style={{ color: "var(--text-2)" }}>
        {label}
      </p>
      <div className="flex gap-2 justify-center mb-6">
        {Array.from({ length: LENGTH }, (_, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            type="text"
            inputMode={inputMode}
            maxLength={1}
            autoComplete={i === 0 ? autoComplete : "off"}
            value={digits[i] ?? ""}
            onChange={(e) => {
              const v = inputMode === "numeric" ? e.target.value.replace(/\D/g, "") : e.target.value;
              setDigit(i, v.slice(-1));
            }}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className="w-11 h-12 rounded-[10px] font-heading font-bold text-center text-lg border-2 transition-colors focus:outline-none focus:border-[var(--accent)] focus:ring-0"
            style={{
              background: "var(--bg-elevated)",
              borderColor: "var(--border-default)",
              color: "var(--text-1)",
            }}
            aria-label={`Digit ${i + 1}`}
          />
        ))}
      </div>
      {error && (
        <p className="font-body text-sm mb-4 text-center" style={{ color: "var(--down)" }}>
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          hapticLight();
          onSubmit();
        }}
        disabled={loading || normalized.length !== LENGTH || disabled}
        className="w-full h-12 rounded-[10px] font-heading font-semibold text-sm uppercase tracking-[0.1em] transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed border-2 border-transparent"
        style={{ background: "var(--accent)", color: "var(--accent-text)" }}
      >
        {loading ? "…" : submitLabel}
      </button>
    </div>
  );
}
