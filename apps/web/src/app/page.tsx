"use client";

import { Suspense } from "react";
import { TopBar } from "@/components/TopBar";
import { HomeInner } from "./HomeInner";

export default function Home() {
  return (
    <>
      <header className="topbar" style={{ gridColumn: "1 / -1", gridRow: 1 }}>
        <TopBar />
      </header>
      <Suspense fallback={null}>
        <HomeInner />
      </Suspense>
    </>
  );
}
