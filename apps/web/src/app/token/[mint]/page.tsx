"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function TokenSharePage() {
  const params = useParams();
  const router = useRouter();
  const mint = params.mint as string;

  useEffect(() => {
    if (mint) {
      router.replace(`/?token=${encodeURIComponent(mint)}`);
    } else {
      router.replace("/");
    }
  }, [mint, router]);

  return null;
}
