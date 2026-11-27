"use client";

import { useEffect, useState } from "react";
import { Wrench, X } from "lucide-react";
import {
  EVENT_START,
  CHRISTMAS_START,
  formatBangkok,
  getEventPhase,
  setTimeOverride,
} from "@/lib/eventTime";
import { glass } from "./Panels";

const K_UNLOCK = "xmas.dev.unlocked";
const K_TIME = "xmas.dev.time";

const PRESETS: { label: string; iso: string }[] = [
  { label: "ก่อนเริ่ม (30 พ.ย. 23:59)", iso: "2026-11-30T23:59:30+07:00" },
  { label: "เริ่มรดน้ำ (1 ธ.ค. 00:00)", iso: "2026-12-01T00:00:00+07:00" },
  { label: "กลางเดือน (12 ธ.ค.)", iso: "2026-12-12T12:00:00+07:00" },
  { label: "ก่อนคริสต์มาส (24 ธ.ค. 23:59)", iso: "2026-12-24T23:59:30+07:00" },
  { label: "วันคริสต์มาส (25 ธ.ค. 00:00)", iso: "2026-12-25T00:00:00+07:00" },
  { label: "เช้าวันคริสต์มาส (25 ธ.ค. 08:00)", iso: "2026-12-25T08:00:00+07:00" },
];

const PHASE_LABEL = {
  PRE_EVENT: "ก่อนเริ่มอีเวนต์",
  GROWING_PHASE: "ช่วงรดน้ำ",
  CHRISTMAS_DAY: "วันคริสต์มาส",
} as const;

export default function DevPanel({ onTimeChange }: { onTimeChange: () => void }) {
  // GameApp is client-only (ssr: false), so sessionStorage is safe in initializers.
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem(K_UNLOCK) === "1",
  );
  const [simIso, setSimIso] = useState<string | null>(() =>
    sessionStorage.getItem(K_TIME),
  );
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);
  const [custom, setCustom] = useState("");

  // restore a simulated time after a page refresh
  useEffect(() => {
    if (unlocked && simIso) {
      setTimeOverride(new Date(simIso));
      onTimeChange();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setErr("");
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (r.ok) {
        sessionStorage.setItem(K_UNLOCK, "1");
        setUnlocked(true);
        setPw("");
      } else if (r.status === 503) {
        setErr("ยังไม่ได้ตั้งค่า ADMIN_PASSWORD บนเซิร์ฟเวอร์");
      } else {
        setErr("รหัสไม่ถูกต้อง");
      }
    } catch {
      setErr("เชื่อมต่อไม่ได้");
    }
    setChecking(false);
  }

  function simulate(iso: string | null) {
    setTimeOverride(iso ? new Date(iso) : null);
    if (iso) sessionStorage.setItem(K_TIME, iso);
    else sessionStorage.removeItem(K_TIME);
    setSimIso(iso);
    onTimeChange();
  }

  function logout() {
    simulate(null);
    sessionStorage.removeItem(K_UNLOCK);
    setUnlocked(false);
    setOpen(false);
  }

  const phase = getEventPhase();

  return (
    <>
      {unlocked && simIso && (
        <div className="pointer-events-none fixed left-1/2 top-2 z-[60] -translate-x-1/2 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-slate-900 shadow-lg">
          🛠 DEV · จำลองเวลา: {formatBangkok(new Date(simIso))} ({PHASE_LABEL[phase]}) — เฉพาะเครื่องนี้
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="โหมด Dev"
        title="โหมด Dev"
        className={`${glass} fixed bottom-2 left-2 z-[60] grid h-8 w-8 place-items-center rounded-full opacity-40 hover:opacity-100 ${
          unlocked && simIso ? "!bg-amber-400 !text-slate-900 !opacity-100" : ""
        }`}
      >
        <Wrench size={14} />
      </button>

      {open && (
        <div className={`${glass} fixed bottom-12 left-2 z-[60] w-80 max-w-[calc(100vw-1rem)] rounded-2xl p-4`}>
          <div className="mb-2 flex items-center justify-between">
            <b>🛠 โหมด Dev</b>
            <button onClick={() => setOpen(false)} aria-label="ปิด">
              <X size={16} />
            </button>
          </div>

          {!unlocked ? (
            <form onSubmit={login} className="space-y-2">
              <input
                type="password"
                autoFocus
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="รหัส Admin"
                className="w-full rounded-lg bg-white/90 px-3 py-2 text-slate-900 outline-none"
              />
              {err && <p className="text-sm text-rose-300">{err}</p>}
              <button
                disabled={!pw || checking}
                className="w-full rounded-lg bg-emerald-500 py-2 font-semibold disabled:opacity-40"
              >
                {checking ? "กำลังตรวจสอบ..." : "เข้าสู่โหมด Dev"}
              </button>
            </form>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="text-white/70">
                จำลองเวลาเฉพาะเบราว์เซอร์นี้ (เวลาไทย) · ขณะนี้: <b>{PHASE_LABEL[phase]}</b>
              </p>
              <div className="grid gap-1">
                {PRESETS.map((p) => (
                  <button
                    key={p.iso}
                    onClick={() => simulate(p.iso)}
                    className={`rounded-lg px-3 py-1.5 text-left ${
                      simIso === p.iso ? "bg-amber-400 text-slate-900" : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                <input
                  type="datetime-local"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg bg-white/90 px-2 py-1 text-slate-900"
                />
                <button
                  disabled={!custom}
                  onClick={() => simulate(`${custom}:00+07:00`)}
                  className="rounded-lg bg-white/15 px-3 hover:bg-white/25 disabled:opacity-40"
                >
                  ตั้ง
                </button>
              </div>
              <p className="text-xs text-white/50">
                เกณฑ์: เริ่ม {formatBangkok(EVENT_START)} · คริสต์มาส {formatBangkok(CHRISTMAS_START)}
              </p>
              <div className="flex gap-1 pt-1">
                <button onClick={() => simulate(null)} className="flex-1 rounded-lg bg-white/15 py-1.5 hover:bg-white/25">
                  กลับเวลาจริง
                </button>
                <button onClick={logout} className="flex-1 rounded-lg bg-rose-500/80 py-1.5 hover:bg-rose-500">
                  ออกจากโหมด Dev
                </button>
              </div>
              <p className="text-xs text-amber-200/80">
                ⚠️ การรดน้ำ/แขวนของประดับขณะทดสอบจะบันทึกลงฐานข้อมูลจริงที่ทุกคนเห็น
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
