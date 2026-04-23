"use client";

import { useState, useEffect, useDeferredValue, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Star, Sun, Moon, Rocket, User, Settings, Trophy, Search } from "lucide-react";
import { WalletButton } from "./WalletButton";
import { NavbarBalance } from "./NavbarBalance";
import { MobileBottomNav } from "./MobileBottomNav";
import { useThemeStore } from "@/store/useThemeStore";
import { useExplorerStore } from "@/store/useExplorerStore";
import { hapticLight } from "@/lib/haptics";
import { useSignals } from "@/hooks/useSignals";

const PRIMARY_NAV = [
  { href: "/", label: "Terminal", icon: Rocket },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
];
const SECONDARY_NAV = [
  { href: "/watchlist", label: "Watchlist", icon: Star },
  { href: "/portfolio", label: "Portfolio", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
];
const LIVE_SIGNAL_WINDOW_MS = 30 * 60 * 1000;
export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const showSignalSummary = pathname === "/";
  const isExplorer = pathname === "/";
  const { signals } = useSignals({ enabled: showSignalSummary });
  const [menuOpen, setMenuOpen] = useState(false);
  const { query, setQuery } = useExplorerStore();
  const deferredQuery = useDeferredValue(query);
  const navItems = PRIMARY_NAV;
  const liveSignals = signals.filter((signal) => Date.now() - Date.parse(signal.timestamp) <= LIVE_SIGNAL_WINDOW_MS);
  const kalshiCount = liveSignals.filter((signal) => signal.source === "kalshi").length;
  const polymarketCount = liveSignals.filter((signal) => signal.source === "polymarket").length;

  useEffect(() => {
    if (!isExplorer) return;
    if (typeof window === "undefined") return;
    const initialQuery = new URLSearchParams(window.location.search).get("q") ?? "";
    if (initialQuery !== query) {
      setQuery(initialQuery);
    }
  }, [isExplorer, pathname, query, setQuery]);

  useEffect(() => {
    if (!isExplorer) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (deferredQuery.trim()) params.set("q", deferredQuery.trim());
    else params.delete("q");
    const next = params.toString();
    const href = next ? `/?${next}` : "/";
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== href) {
      router.replace(href, { scroll: false });
    }
  }, [deferredQuery, isExplorer, router]);

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
        className="sticky top-0 z-50 flex h-16 items-center justify-between px-4 md:h-[74px] md:px-6 flex-shrink-0"
        style={{
          background: "var(--bg-base)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <Link href="/" onClick={() => hapticLight()} className="flex min-w-[72px] items-center py-2 topbar-logo-wrap">
          <img
            src="/brand/mark.svg"
            alt="Siren"
            className="h-7 w-auto md:h-8 topbar-logo"
            style={{ display: "block" }}
          />
        </Link>
        {isExplorer && (
          <div
            className="mx-4 hidden max-w-[540px] flex-1 items-center gap-3 rounded-[20px] border px-4 md:flex"
            style={{ height: 48, borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}
          >
            <Search className="h-4 w-4 shrink-0" style={{ color: "var(--text-3)" }} />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Markets"
              className="w-full bg-transparent font-body text-sm outline-none placeholder:text-[var(--text-3)]"
              style={{ color: "var(--text-1)" }}
            />
          </div>
        )}
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
              } as CSSProperties,
            };
            return <Link key={href} {...linkProps}>{label}</Link>;
          })}
        </nav>
        {showSignalSummary && liveSignals.length > 0 && !isExplorer && (
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
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#09C285" }} />
              <span style={{ color: "#09C285" }}>{kalshiCount}</span>
            </span>
          </div>
        )}
        <div className="hidden md:flex items-center gap-2.5">
          <NavbarBalance />
          <div
            className="flex items-center gap-1 rounded-[18px] border p-1"
            style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-elevated) 94%, transparent)" }}
          >
            {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => hapticLight()}
                  className="flex h-10 w-10 items-center justify-center rounded-[14px] transition-all hover:bg-[var(--bg-hover)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                  style={{
                    background: isActive ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                    color: isActive ? "var(--accent)" : "var(--text-2)",
                  }}
                  aria-label={label}
                >
                  <Icon className="w-4 h-4" />
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { hapticLight(); toggleTheme(); }}
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border font-mono text-sm transition-colors duration-[120ms] ease hover:bg-[var(--bg-hover)]"
            style={{ color: "var(--text-2)", borderColor: "var(--border-subtle)", background: "var(--bg-elevated)" }}
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
                {isExplorer && (
                  <div className="mb-3 rounded-[12px] border px-3 py-2.5" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-surface)" }}>
                    <div className="flex items-center gap-2">
                      <Search className="h-4 w-4" style={{ color: "var(--text-3)" }} />
                      <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search Markets"
                        className="w-full bg-transparent font-body text-sm outline-none placeholder:text-[var(--text-3)]"
                        style={{ color: "var(--text-1)" }}
                      />
                    </div>
                  </div>
                )}
                <p className="px-3 pb-1 pt-1 font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                  Navigate
                </p>
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
                <p className="px-3 pb-1 pt-4 font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                  Workspace
                </p>
                {SECONDARY_NAV.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => { hapticLight(); setMenuOpen(false); }}
                      className="font-body font-medium text-sm py-3 px-3 rounded-[8px]"
                      style={{ color: isActive ? "var(--accent)" : "var(--text-1)", background: "var(--bg-elevated)" }}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </span>
                    </Link>
                  );
                })}
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
      <MobileBottomNav />
    </>
  );
}
