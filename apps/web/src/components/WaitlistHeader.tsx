"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";

export function WaitlistHeader() {
  const { theme, toggleTheme } = useThemeStore();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { hapticLight(); setMenuOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <>
      <header
        className="h-14 flex items-center justify-between px-4 flex-shrink-0"
        style={{
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link href="/waitlist" onClick={() => hapticLight()} className="flex items-center gap-2 py-2">
          <img src="/brand/mark.svg" alt="Siren" className="h-7 w-auto md:h-8 topbar-logo" style={{ display: "block" }} />
          <span className="font-heading font-semibold text-sm uppercase tracking-wider hidden sm:inline" style={{ color: "var(--text-1)" }}>
            Waitlist
          </span>
        </Link>
        <button
          type="button"
          onClick={() => { hapticLight(); setMenuOpen(true); }}
          className="w-10 h-10 rounded-[8px] flex items-center justify-center"
          style={{ color: "var(--text-1)", background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[100]"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => { hapticLight(); setMenuOpen(false); }}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-[280px] z-[101] flex flex-col"
              style={{
                background: "var(--bg-base)",
                borderLeft: "1px solid var(--border-subtle)",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-center justify-between h-14 px-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                <span className="font-heading font-semibold text-sm uppercase" style={{ color: "var(--text-1)" }}>Menu</span>
                <button
                  type="button"
                  onClick={() => { hapticLight(); setMenuOpen(false); }}
                  className="w-10 h-10 rounded-[8px] flex items-center justify-center"
                  style={{ color: "var(--text-1)", background: "var(--bg-elevated)" }}
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-4 flex flex-col gap-2">
                <span className="font-body text-xs uppercase tracking-wider py-2" style={{ color: "var(--text-3)" }}>
                  Waitlist (current)
                </span>
                <Link
                  href="/access"
                  onClick={() => { hapticLight(); setMenuOpen(false); }}
                  className="font-body font-medium text-sm py-3 px-3 rounded-[8px] transition-colors"
                  style={{ color: "var(--text-1)", background: "var(--bg-elevated)" }}
                >
                  Enter code
                </Link>
                <div className="flex items-center justify-between py-3 px-3 rounded-[8px]" style={{ background: "var(--bg-elevated)" }}>
                  <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>Theme</span>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); toggleTheme(); setMenuOpen(false); }}
                    className="w-9 h-9 rounded-[6px] flex items-center justify-center text-sm"
                    style={{ background: "var(--bg-surface)", color: "var(--text-1)" }}
                  >
                    {theme === "dark" ? "☀" : "☽"}
                  </button>
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
