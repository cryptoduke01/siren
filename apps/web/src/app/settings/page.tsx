"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Copy, Loader2, Scale, Shield, Upload, Wallet, Radar, LineChart } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useResultModalStore } from "@/store/useResultModalStore";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";
import { getWalletAuthHeaders } from "@/lib/requestAuth";
import { usePrivy } from "@privy-io/react-auth";

const MAX_FILE_BYTES = 1_500_000;

export default function SettingsPage() {
  const { publicKey, connected, signMessage } = useSirenWallet();
  const { login, ready } = usePrivy();
  const walletKey = publicKey?.toBase58() ?? null;
  const queryClient = useQueryClient();
  const showResultModal = useResultModalStore((s) => s.show);
  const [uploading, setUploading] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile", walletKey],
    queryFn: async () => {
      if (!walletKey) return null;
      const res = await fetch(`${API_URL}/api/users/profile?wallet=${encodeURIComponent(walletKey)}`, { credentials: "omit" });
      if (!res.ok) return null;
      const payload = await res.json().catch(() => ({}));
      return (payload?.data ?? null) as {
        username?: string;
        display_name?: string;
        avatar_url?: string | null;
      } | null;
    },
    enabled: !!walletKey,
    staleTime: 30_000,
  });
  const { data: proofStatus } = useQuery({
    queryKey: ["dflow-proof-status", walletKey],
    queryFn: async () => {
      if (!walletKey) return { verified: false };
      const authHeaders = await getWalletAuthHeaders({ wallet: walletKey, signMessage, scope: "read" });
      const res = await fetch(`${API_URL}/api/dflow/proof-status?address=${encodeURIComponent(walletKey)}`, {
        credentials: "omit",
        headers: authHeaders,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) return { verified: false };
      return (payload?.data ?? { verified: false }) as { verified: boolean };
    },
    enabled: !!walletKey,
    staleTime: 120_000,
  });
  const verified = !!proofStatus?.verified;

  const onPickAvatar = useCallback(
    async (file: File | null) => {
      if (!walletKey || !file) return;
      if (!file.type.startsWith("image/")) {
        showResultModal({ type: "error", title: "Photo", message: "Choose an image file (JPEG or PNG)." });
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        showResultModal({ type: "error", title: "Photo too large", message: "Max size is about 1.5 MB." });
        return;
      }
      setUploading(true);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("read failed"));
          reader.readAsDataURL(file);
        });
        const authHeaders = await getWalletAuthHeaders({ wallet: walletKey, signMessage, scope: "write" });
        const res = await fetch(`${API_URL}/api/users/avatar`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({ wallet: walletKey, imageBase64: dataUrl }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          showResultModal({
            type: "error",
            title: "Upload failed",
            message: typeof payload?.error === "string" ? payload.error : "Could not save photo.",
          });
          return;
        }
        showResultModal({ type: "success", title: "Photo updated", message: "Your profile picture is saved." });
        queryClient.invalidateQueries({ queryKey: ["user-profile", walletKey] });
      } catch {
        showResultModal({ type: "error", title: "Upload", message: "Could not read or upload the image." });
      } finally {
        setUploading(false);
      }
    },
    [walletKey, showResultModal, queryClient],
  );
  const copyAddress = useCallback(async () => {
    if (!walletKey) return;
    try {
      await navigator.clipboard.writeText(walletKey);
      setAddressCopied(true);
      window.setTimeout(() => setAddressCopied(false), 1800);
    } catch {
      showResultModal({ type: "error", title: "Copy failed", message: "Could not copy your wallet address." });
    }
  }, [walletKey, showResultModal]);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-20 pt-6 md:px-5 md:pt-8 font-body">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 font-sub text-xs mb-6"
          style={{ color: "var(--text-3)" }}
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="h-3 w-3" /> Back to portfolio
        </Link>

        <div className="max-w-2xl">
          <h1 className="font-heading text-2xl font-bold" style={{ color: "var(--text-1)" }}>
            Settings
          </h1>
          <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
            Manage your profile, wallet identity, and the references people use when they need context about you or Siren.
          </p>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:items-start">
          {!connected || !walletKey ? (
            <>
              <div
                className="rounded-2xl border p-5"
                style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                      Account
                    </p>
                    <h2 className="mt-1 font-heading text-lg font-semibold" style={{ color: "var(--text-1)" }}>
                      Connect When You Want Account Controls
                    </h2>
                  </div>
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-2xl"
                    style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
                  >
                    <Wallet className="h-4 w-4" />
                  </div>
                </div>

                <p className="mt-4 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                  You do not need to connect to browse Siren. Connect only when you want to manage your public profile, sync your portfolio, or route trades from the app.
                </p>

                <button
                  type="button"
                  disabled={!ready || connecting}
                  onClick={async () => {
                    hapticLight();
                    setConnecting(true);
                    try {
                      await login();
                    } catch (error) {
                      showResultModal({
                        type: "error",
                        title: "Connect",
                        message: error instanceof Error ? error.message : "Could not start login.",
                      });
                    } finally {
                      setConnecting(false);
                    }
                  }}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-heading text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-150 hover:brightness-110 disabled:opacity-60"
                  style={{ background: "var(--accent)", color: "var(--accent-text)" }}
                >
                  {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
                  {connecting ? "Connecting…" : "Connect Wallet"}
                </button>
              </div>

              <div className="grid gap-4">
                {[
                  {
                    icon: Radar,
                    title: "Execution Identity",
                    body: "Confirm which wallet Siren should use for routing, proof checks, and trade history.",
                  },
                  {
                    icon: LineChart,
                    title: "Portfolio Sync",
                    body: "See positions, trade attempts, and execution history without guessing what belongs to you.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border p-5"
                    style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
                        style={{ background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }}
                      >
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                          {item.title}
                        </h3>
                        <p className="mt-2 font-body text-sm leading-relaxed" style={{ color: "var(--text-2)" }}>
                          {item.body}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div
                  className="rounded-2xl border p-5"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-sub text-[10px] uppercase tracking-[0.18em]" style={{ color: "var(--text-3)" }}>
                        Account
                      </p>
                      <h2 className="mt-1 font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                        Wallet identity and trading status
                      </h2>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 font-sub text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        background: verified ? "color-mix(in srgb, var(--up) 14%, transparent)" : "color-mix(in srgb, var(--accent) 14%, transparent)",
                        color: verified ? "var(--up)" : "var(--accent)",
                      }}
                    >
                      {verified ? "Ready" : "Needs review"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border px-4 py-4" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Connected wallet
                      </p>
                      <p className="mt-2 break-all font-mono text-xs leading-relaxed" style={{ color: "var(--text-1)" }}>
                        {walletKey}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyAddress()}
                        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                        style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
                      >
                        {addressCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {addressCopied ? "Copied" : "Copy address"}
                      </button>
                    </div>

                    <div className="rounded-xl border px-4 py-4" style={{ background: "var(--bg-base)", borderColor: "var(--border-subtle)" }}>
                      <p className="font-sub text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-3)" }}>
                        Trading access
                      </p>
                      <div className="mt-2 flex items-start gap-2">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0" style={{ color: verified ? "var(--up)" : "var(--accent)" }} />
                        <div>
                          <p className="font-body text-sm leading-relaxed" style={{ color: verified ? "var(--up)" : "var(--text-1)" }}>
                            {verified ? "Ready to trade Kalshi from Siren." : "Identity verification still needs attention."}
                          </p>
                          <Link
                            href="/portfolio"
                            onClick={() => hapticLight()}
                            className="mt-3 inline-flex items-center gap-2 text-xs font-semibold"
                            style={{ color: "var(--accent)" }}
                          >
                            Review this in portfolio
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="rounded-2xl border p-5"
                  style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-heading text-base font-semibold" style={{ color: "var(--text-1)" }}>
                        Profile photo
                      </h2>
                      <p className="mt-1 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
                        Used on share cards and around the app.
                      </p>
                    </div>
                    <Link href="/portfolio" onClick={() => hapticLight()} className="font-sub text-[11px]" style={{ color: "var(--accent)" }}>
                      Open portfolio
                    </Link>
                  </div>

                  <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt=""
                        className="h-20 w-20 rounded-full object-cover border"
                        style={{ borderColor: "var(--border-subtle)" }}
                      />
                    ) : (
                      <div
                        className="flex h-20 w-20 items-center justify-center rounded-full font-heading text-lg font-bold"
                        style={{ background: "var(--bg-elevated)", color: "var(--text-3)" }}
                      >
                        {isLoading ? "…" : (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-2.5 font-heading text-xs font-semibold transition-colors hover:brightness-110 focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--accent)] focus-within:ring-offset-2"
                      style={{
                        borderColor: "var(--accent)",
                        color: "var(--accent)",
                        opacity: uploading ? 0.6 : 1,
                      }}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {uploading ? "Uploading…" : "Upload photo"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        disabled={uploading}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          e.target.value = "";
                          void onPickAvatar(f ?? null);
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </>
          )}

          <div
            className="rounded-2xl border p-5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Docs and Policies
            </h2>
            <p className="mt-2 font-sub text-sm leading-relaxed" style={{ color: "var(--text-3)" }}>
              Keep the core references close when you need product context or legal detail.
            </p>

            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              <a
                href="https://docs.onsiren.xyz"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => hapticLight()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
              >
                <BookOpen className="h-4 w-4" />
                Docs
              </a>
              <Link
                href="/terms"
                onClick={() => hapticLight()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
              >
                <Scale className="h-4 w-4" />
                Terms
              </Link>
              <Link
                href="/privacy"
                onClick={() => hapticLight()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2"
                style={{ borderColor: "var(--border-subtle)", color: "var(--text-2)" }}
              >
                <Shield className="h-4 w-4" />
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
