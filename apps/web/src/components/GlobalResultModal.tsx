"use client";

import { useResultModalStore } from "@/store/useResultModalStore";
import { ResultModal } from "./ResultModal";

export function GlobalResultModal() {
  const payload = useResultModalStore((s) => s.payload);
  const hide = useResultModalStore((s) => s.hide);
  if (!payload) return null;
  return (
    <ResultModal
      type={payload.type}
      title={payload.title}
      message={payload.message}
      txSignature={payload.txSignature}
      actionLabel={payload.actionLabel}
      actionHref={payload.actionHref}
      onClose={hide}
    />
  );
}
