"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { TopBar } from "@/components/TopBar";
import { XCircle } from "lucide-react";
import { hapticLight } from "@/lib/haptics";
import { PasscodeDigits } from "@/components/PasscodeDigits";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = () => {
    if (!code.trim() || code.length !== 6) return;
    hapticLight();
    setError(null);
    setLoading(true);
    fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setError(data.error || "Invalid code");
          setLoading(false);
          return;
        }
        router.replace("/onboarding");
        router.refresh();
      })
      .catch(() => {
        setError("Something went wrong");
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden" style={{ background: "var(--bg-void)" }}>
      <TopBar />
      <main className="flex-1 flex items-center justify-center px-4">
        <div
          className="w-full max-w-sm rounded-2xl border px-6 py-8"
          style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
        >
          <h1 className="font-heading font-bold text-xl mb-2" style={{ color: "var(--text-1)" }}>
            Enter access code
          </h1>
          <PasscodeDigits
            value={code}
            onChange={setCode}
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
            label="Enter the 6-digit access code to continue"
            submitLabel="Continue"
          />
          <p className="font-body text-xs mt-6 text-center" style={{ color: "var(--text-2)" }}>
            Don’t have a code?{" "}
            <Link href="/waitlist" className="underline" style={{ color: "var(--accent)" }} onClick={() => hapticLight()}>
              Join the Waitlist
            </Link>
          </p>
        </div>
      </main>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.6)" }}
            onClick={() => { hapticLight(); setError(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="w-full max-w-sm rounded-2xl border p-6 text-center"
              style={{ background: "var(--bg-surface)", borderColor: "var(--border-subtle)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <XCircle className="w-12 h-12 mx-auto mb-4" style={{ color: "var(--down)" }} />
              <h3 className="font-heading font-bold text-lg mb-2" style={{ color: "var(--text-1)" }}>
                Invalid code
              </h3>
              <p className="font-body text-sm mb-6" style={{ color: "var(--text-2)" }}>
                {error}
              </p>
              <button
                type="button"
                onClick={() => { hapticLight(); setError(null); }}
                className="w-full py-2.5 rounded-xl font-body text-sm font-medium border"
                style={{ background: "var(--bg-elevated)", color: "var(--text-1)", borderColor: "var(--border-default)" }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
