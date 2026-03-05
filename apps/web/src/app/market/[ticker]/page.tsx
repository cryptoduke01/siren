"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function MarketSharePage() {
  const params = useParams();
  const router = useRouter();
  const ticker = params.ticker as string;

  useEffect(() => {
    if (ticker) {
      router.replace(`/?market=${encodeURIComponent(ticker)}`);
    } else {
      router.replace("/");
    }
  }, [ticker, router]);

  return null;
}
