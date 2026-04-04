"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Star, Sun, Moon, Rocket, TrendingUp, User, Settings, Trophy } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { NavbarBalance } from "./NavbarBalance";
import { useThemeStore } from "@/store/useThemeStore";
import { hapticLight } from "@/lib/haptics";
import { useSignals } from "@/hooks/useSignals";

const NAV = [
  { href: "/", label: "Terminal", icon: Rocket },
  { href: "/trending", label: "Trending", icon: TrendingUp },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
];
const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;

export function TopBar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useThemeStore();
  const showSignalSummary = pathname === "/";
  const { signals } = useSignals({ enabled: showSignalSummary });
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = NAV;
  const liveSignals = signals.filter((signal) => Date.now() - Date.parse(signal.timestamp) <= LIVE_SIGNAL_WINDOW_MS);
  const kalshiCount = liveSignals.filter((signal) => signal.source === "kalshi").length;
  const polymarketCount = liveSignals.filter((signal) => signal.source === "polymarket").length;

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
        className="sticky top-0 z-50 h-12 flex items-center justify-between px-3 md:px-4 flex-shrink-0"
        style={{
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link href="/" onClick={() => hapticLight()} className="flex items-center gap-2 py-2 topbar-logo-wrap">
          <img
            src="/brand/mark.svg"
            alt="Siren"
            className="h-6 w-auto md:h-8 topbar-logo"
            style={{ display: "block" }}
          />
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map(({ href, label }) => {
            const isActive = pathname === href || (href === "/" && pathname === "/");
            const linkProps = {
              href,
              onClick: () => hapticLight(),
              className: "font-body font-medium text-xs uppercase hover:text-[var(--text-1)] active:scale-95 transition-all",
              style: {
                letterSpacing: "0.08em",
                color: isActive ? "var(--accent)" : "var(--text-3)",
                borderBottom: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                marginBottom: "-1px",
                paddingBottom: "2px",
                transition: "color 120ms ease, border-color 120ms ease",
              } as React.CSSProperties,
            };
            return <Link key={href} {...linkProps}>{label}</Link>;
          })}
        </nav>
        {showSignalSummary && liveSignals.length > 0 && (
          <div
            className="hidden lg:flex items-center gap-3 rounded-full border px-3 py-1.5 font-mono text-[10px] tabular-nums"
            style={{
              borderColor: "var(--border-subtle)",
              background: "var(--bg-elevated)",
            }}
          >
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "var(--up)" }} />
              <span style={{ color: "var(--text-1)" }}>{liveSignals.length} live</span>
            </span>
            <span className="h-3 w-px" style={{ background: "var(--border-subtle)" }} />
            <span className="flex items-center gap-1">
              <img src="/brand/polymarket/icon-white.svg" alt="" className="h-3 w-3 opacity-70" />
              <span style={{ color: "#5B8AFF" }}>{polymarketCount}</span>
            </span>
            <span className="flex items-center gap-1">
              <img src="/brand/kalshi/logo-green.svg" alt="" className="h-2.5 w-auto" />
              <span style={{ color: "#09C285" }}>{kalshiCount}</span>
            </span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-2">
          <NavbarBalance />
          <Link
            href="/watchlist"
            onClick={() => hapticLight()}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-all hover:bg-[var(--bg-hover)] active:scale-95"
            style={{ color: pathname === "/watchlist" ? "var(--accent)" : "var(--text-2)" }}
            aria-label="Watchlist"
          >
            <Star className="w-4 h-4" />
          </Link>
          <Link
            href="/portfolio"
            onClick={() => hapticLight()}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:ring-2 hover:ring-[var(--accent)]/30 active:scale-95"
            style={{
              background: pathname === "/portfolio"
                ? "linear-gradient(135deg, var(--accent), #00C853)"
                : "var(--bg-elevated)",
              color: pathname === "/portfolio" ? "var(--bg-base)" : "var(--text-2)",
              border: "1px solid var(--border-subtle)",
            }}
            aria-label="Portfolio"
          >
            <User className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/settings"
            onClick={() => hapticLight()}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-all hover:bg-[var(--bg-hover)] active:scale-95"
            style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--text-2)" }}
            aria-label="Settings"
          >
            <Settings className="w-4 h-4" />
          </Link>
          <button
            type="button"
            onClick={() => { hapticLight(); toggleTheme(); }}
            className="w-8 h-8 rounded-[6px] flex items-center justify-center font-mono text-sm transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-2)" }}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <WalletButton />
        </div>
        <button
          type="button"
          onClick={() => { hapticLight(); setMenuOpen(true); }}
          className="md:hidden w-10 h-10 rounded-[8px] flex items-center justify-center"
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
              className="fixed inset-0 z-[100] md:hidden"
              style={{ background: "rgba(0,0,0,0.5)" }}
              onClick={() => { hapticLight(); setMenuOpen(false); }}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-[280px] z-[101] flex flex-col md:hidden"
              style={{
                background: "var(--bg-base)",
                borderLeft: "1px solid var(--border-subtle)",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
              }}
            >
              <div className="flex items-center justify-between h-12 px-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
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
              <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || (href === "/" && pathname === "/");
                  const className = "font-body font-medium text-sm py-3 px-3 rounded-[8px]";
                  const style = { color: isActive ? "var(--accent)" : "var(--text-1)", background: "var(--bg-elevated)" };
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => { hapticLight(); setMenuOpen(false); }}
                      className={className}
                      style={style}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                    </Link>
                  );
                })}
                <Link
                  href="/watchlist"
                  onClick={() => { hapticLight(); setMenuOpen(false); }}
                  className="font-body font-medium text-sm py-3 px-3 rounded-[8px]"
                  style={{ color: pathname === "/watchlist" ? "var(--accent)" : "var(--text-1)", background: "var(--bg-elevated)" }}
                >
                  Watchlist
                </Link>
                <Link
                  href="/portfolio"
                  onClick={() => { hapticLight(); setMenuOpen(false); }}
                  className="font-body font-medium text-sm py-3 px-3 rounded-[8px]"
                  style={{ color: pathname === "/portfolio" ? "var(--accent)" : "var(--text-1)", background: "var(--bg-elevated)" }}
                >
                  Portfolio
                </Link>
                <Link
                  href="/settings"
                  onClick={() => { hapticLight(); setMenuOpen(false); }}
                  className="font-body font-medium text-sm py-3 px-3 rounded-[8px]"
                  style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--text-1)", background: "var(--bg-elevated)" }}
                >
                  Settings
                </Link>
                <div className="flex items-center justify-between py-3 px-3 rounded-[8px] mt-2" style={{ background: "var(--bg-elevated)" }}>
                  <span className="font-body text-sm" style={{ color: "var(--text-2)" }}>Theme</span>
                  <button
                    type="button"
                    onClick={() => { hapticLight(); toggleTheme(); setMenuOpen(false); }}
                    className="w-9 h-9 rounded-[6px] flex items-center justify-center text-sm"
                    style={{ background: "var(--bg-surface)", color: "var(--text-1)" }}
                  >
                    {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </div>
                <div className="pt-2">
                  <WalletButton fullWidth />
                </div>
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
