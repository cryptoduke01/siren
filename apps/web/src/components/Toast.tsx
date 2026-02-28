"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useToastStore } from "@/store/useToastStore";
import { AlertCircle, CheckCircle, Info } from "lucide-react";

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none sm:left-auto sm:right-4 sm:max-w-sm">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="pointer-events-auto flex items-start gap-3 p-4 rounded-lg border shadow-lg"
            style={{
              background: "var(--bg-surface)",
              borderColor: t.type === "error" ? "var(--red)" : t.type === "success" ? "var(--green)" : "var(--border)",
            }}
          >
            {t.type === "error" && <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "var(--red)" }} />}
            {t.type === "success" && <CheckCircle className="w-5 h-5 shrink-0" style={{ color: "var(--green)" }} />}
            {t.type === "info" && <Info className="w-5 h-5 shrink-0" style={{ color: "var(--accent-primary)" }} />}
            <p className="flex-1 text-sm text-[var(--text-primary)]">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-sm shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
