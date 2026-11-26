"use client";

import dynamic from "next/dynamic";

// The 3D scene needs the browser (WebGL, localStorage), so skip SSR.
const GameApp = dynamic(() => import("./GameApp"), {
  ssr: false,
  loading: () => (
    <div className="grid h-dvh place-items-center bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-bounce text-5xl">🎄</div>
        <p className="mt-2 text-sm text-white/70">กำลังโหลดโลกหิมะ...</p>
      </div>
    </div>
  ),
});

export default function ClientRoot() {
  return <GameApp />;
}
