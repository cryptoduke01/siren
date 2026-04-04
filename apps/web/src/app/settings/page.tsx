"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { useSirenWallet } from "@/contexts/SirenWalletContext";
import { useToastStore } from "@/store/useToastStore";
import { hapticLight } from "@/lib/haptics";
import { API_URL } from "@/lib/apiUrl";

const MAX_FILE_BYTES = 1_500_000;

export default function SettingsPage() {
  const { publicKey, connected } = useSirenWallet();
  const walletKey = publicKey?.toBase58() ?? null;
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  const [uploading, setUploading] = useState(false);

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

  const onPickAvatar = useCallback(
    async (file: File | null) => {
      if (!walletKey || !file) return;
      if (!file.type.startsWith("image/")) {
        addToast("Choose an image file.", "error");
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        addToast("Image too large (max ~1.5MB).", "error");
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
        const res = await fetch(`${API_URL}/api/users/avatar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletKey, imageBase64: dataUrl }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          addToast(typeof payload?.error === "string" ? payload.error : "Upload failed.", "error");
          return;
        }
        addToast("Profile photo updated.", "success");
        queryClient.invalidateQueries({ queryKey: ["user-profile", walletKey] });
      } catch {
        addToast("Could not upload image.", "error");
      } finally {
        setUploading(false);
      }
    },
    [walletKey, addToast, queryClient],
  );

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg-base)" }}>
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pb-12 pt-6 md:pt-8 font-body">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 font-sub text-xs mb-6"
          style={{ color: "var(--text-3)" }}
          onClick={() => hapticLight()}
        >
          <ArrowLeft className="h-3 w-3" /> Back to portfolio
        </Link>

        <h1 className="font-heading text-xl font-bold" style={{ color: "var(--text-1)" }}>
          Settings
        </h1>
        <p className="mt-2 font-sub text-sm" style={{ color: "var(--text-3)" }}>
          Profile photo is used on share cards and in the app. Username can be changed from the portfolio page.
        </p>

        {!connected || !walletKey ? (
          <p className="mt-8 font-body text-sm" style={{ color: "var(--text-3)" }}>
            Connect your wallet to manage profile.
          </p>
        ) : (
          <div
            className="mt-8 rounded-xl border p-5"
            style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
          >
            <h2 className="font-heading text-sm font-semibold" style={{ color: "var(--text-1)" }}>
              Profile photo
            </h2>
            <p className="mt-1 font-sub text-xs leading-relaxed" style={{ color: "var(--text-3)" }}>
              Requires Supabase: public bucket <code className="font-label text-[10px]">avatars</code>, column{" "}
              <code className="font-label text-[10px]">users.avatar_url</code>. See{" "}
              <code className="font-label text-[10px]">apps/api/sql/add_avatar_url.sql</code>.
            </p>

            <div className="mt-4 flex items-center gap-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover border"
                  style={{ borderColor: "var(--border-subtle)" }}
                />
              ) : (
                <div
                  className="h-20 w-20 rounded-full flex items-center justify-center font-heading text-lg font-bold"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-3)" }}
                >
                  {isLoading ? "…" : (profile?.display_name || profile?.username || "?").charAt(0).toUpperCase()}
                </div>
              )}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 font-heading text-xs font-semibold transition-colors hover:brightness-110"
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
        )}
      </main>
    </div>
  );
}
