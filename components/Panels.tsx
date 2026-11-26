"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Shuffle, Trophy, X } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
import {
  getCountdown,
  getGrowth,
  getNextMilestone,
  type Countdown as CountdownT,
} from "@/lib/eventTime";
import {
  STOCKING_COLORS,
  STOCKING_STYLES,
  packStocking,
  parseStocking,
  type StockingStyle,
} from "@/lib/items";
import type { DbDeco, DbTree, DbUser, DbWish } from "@/lib/types";

export const glass =
  "bg-slate-900/55 backdrop-blur-md border border-white/15 text-white shadow-xl";

// ---- Countdown badge ---------------------------------------------------
export function CountdownBadge() {
  const [cd, setCd] = useState<{ label: string; c: CountdownT } | null>(null);
  useEffect(() => {
    const tick = () => {
      const m = getNextMilestone();
      setCd(m ? { label: m.label, c: getCountdown(m.target) } : null);
    };
    tick();
    const i = setInterval(tick, 1000);
    return () => clearInterval(i);
  }, []);
  if (!cd) return <span className="text-amber-300 font-semibold">🎄 วันคริสต์มาสมาถึงแล้ว!</span>;
  const { days, hours, minutes, seconds } = cd.c;
  return (
    <span className="text-sm">
      ⏳ อีก{" "}
      <b className="tabular-nums">
        {days}ว {String(hours).padStart(2, "0")}:{String(minutes).padStart(2, "0")}:
        {String(seconds).padStart(2, "0")}
      </b>{" "}
      <span className="opacity-80">ถึง {cd.label}</span>
    </span>
  );
}

// ---- Name modal --------------------------------------------------------
export function NameModal({
  open,
  initial,
  dismissible,
  onSave,
  onClose,
}: {
  open: boolean;
  initial: string;
  dismissible: boolean;
  onSave: (n: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form
        className={`${glass} w-full max-w-sm rounded-3xl p-6 text-center`}
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSave(name.trim());
        }}
      >
        <div className="text-5xl">🎄</div>
        <h2 className="mt-2 text-xl font-bold">ยินดีต้อนรับสู่งานคริสต์มาส!</h2>
        <p className="mt-1 text-sm text-white/70">ตั้งชื่อที่จะแสดงบนต้นไม้ ของประดับ และคำอธิษฐาน</p>
        <input
          autoFocus
          maxLength={30}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อที่แสดง"
          className="mt-4 w-full rounded-xl bg-white/90 px-4 py-3 text-center text-slate-900 outline-none ring-2 ring-transparent focus:ring-emerald-400"
        />
        <div className="mt-4 flex gap-2">
          {dismissible && (
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-white/15 py-2.5 hover:bg-white/25">
              ยกเลิก
            </button>
          )}
          <button
            disabled={!name.trim()}
            className="flex-1 rounded-xl bg-emerald-500 py-2.5 font-semibold hover:bg-emerald-400 disabled:opacity-40"
          >
            เริ่มเลย ✨
          </button>
        </div>
      </form>
    </div>
  );
}

// ---- Toasts ------------------------------------------------------------
export function Toasts({ items }: { items: { id: number; text: string }[] }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-20 z-40 flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div key={t.id} className={`${glass} toast-in rounded-full px-4 py-2 text-sm`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---- Mini tree (gallery card) -----------------------------------------
function MiniTree({ tree, decos }: { tree: DbTree; decos: DbDeco[] }) {
  const g = getGrowth(tree.water_count, tree.fertilizer_count);
  const tiers = 3 + Math.round(g * 3);
  return (
    <svg viewBox="0 0 100 130" className="h-32 w-full">
      <rect x="0" y="0" width="100" height="130" rx="10" fill="#10243f" />
      <rect x="45" y="100" width="10" height="16" fill="#6b4423" />
      {Array.from({ length: tiers }, (_, i) => {
        const y = 100 - i * (62 / tiers) * (0.5 + g * 0.5) - 12;
        const w = (38 - i * (28 / tiers)) * (0.55 + g * 0.45);
        return (
          <polygon
            key={i}
            points={`50,${y - 26 * (0.6 + g * 0.4)} ${50 - w},${y + 8} ${50 + w},${y + 8}`}
            fill={i % 2 ? "#27905a" : "#1f7a4d"}
          />
        );
      })}
      {decos.slice(0, 40).map((d) => (
        <circle
          key={d.id}
          cx={50 + d.pos_x * 20}
          cy={118 - d.pos_y * 18}
          r="2.6"
          fill={d.color}
        />
      ))}
      {g >= 1 && <polygon points="50,6 53,14 62,14 55,19 58,28 50,22 42,28 45,19 38,14 47,14" fill="#ffd23f" />}
    </svg>
  );
}

// ---- Contest gallery ---------------------------------------------------
export function Gallery({
  myId,
  users,
  viewingId,
  onView,
  onClose,
  notify,
}: {
  myId: string | null;
  users: Record<string, DbUser>;
  viewingId: string | null;
  onView: (id: string | null) => void;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const [trees, setTrees] = useState<DbTree[]>([]);
  const [decos, setDecos] = useState<DbDeco[]>([]);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    (async () => {
      const { data: t } = await sb.from("trees").select("*").eq("type", "personal");
      const list = (t ?? []) as DbTree[];
      const { data: d } = list.length
        ? await sb.from("decorations").select("*").in("tree_id", list.map((x) => x.id))
        : { data: [] };
      const { data: v } = myId
        ? await sb.from("tree_votes").select("tree_id").eq("user_id", myId)
        : { data: [] };
      if (!alive) return;
      setTrees(list);
      setDecos((d ?? []) as DbDeco[]);
      setMyVotes(new Set(((v ?? []) as { tree_id: string }[]).map((x) => x.tree_id)));
    })();
    return () => {
      alive = false;
    };
  }, [myId, reload]);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setReload((n) => n + 1), 600);
    };
    const ch = sb
      .channel("gallery-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "trees" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "tree_votes" }, bump)
      .on("postgres_changes", { event: "*", schema: "public", table: "decorations" }, bump)
      .subscribe();
    return () => {
      clearTimeout(timer);
      sb.removeChannel(ch);
    };
  }, []);

  const sorted = useMemo(
    () => [...trees].sort((a, b) => b.votes_count - a.votes_count),
    [trees],
  );

  async function toggleVote(t: DbTree) {
    const sb = getSupabase();
    if (!sb || !myId) return;
    const has = myVotes.has(t.id);
    const { error } = has
      ? await sb.from("tree_votes").delete().eq("tree_id", t.id).eq("user_id", myId)
      : await sb.from("tree_votes").insert({ tree_id: t.id, user_id: myId });
    if (error) return notify(error.message);
    setMyVotes((s) => {
      const n = new Set(s);
      if (has) n.delete(t.id);
      else n.add(t.id);
      return n;
    });
    setReload((n) => n + 1);
    notify(has ? "ยกเลิกโหวตแล้ว" : "โหวตแล้ว 🏆");
  }

  return (
    <aside className={`${glass} absolute right-3 top-28 bottom-28 z-30 flex w-[22rem] max-w-[calc(100vw-1.5rem)] flex-col rounded-3xl`}>
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className="flex items-center gap-2 font-bold">
          <Trophy size={18} className="text-amber-300" /> ประกวดต้นไม้ส่วนตัว
        </h3>
        <button onClick={onClose} aria-label="ปิด" className="rounded-full p-1 hover:bg-white/15">
          <X size={18} />
        </button>
      </header>
      <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto px-3 pb-3">
        {sorted.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-white/60">
            ยังไม่มีต้นไม้ส่วนตัว — ไปที่แท็บ “ต้นไม้ของฉัน” เพื่อเริ่มแต่งต้นแรก!
          </p>
        )}
        {sorted.map((t, i) => {
          const mine = t.owner_id === myId;
          return (
            <div
              key={t.id}
              className={`rounded-2xl bg-white/8 p-2 ${viewingId === t.id ? "ring-2 ring-amber-300" : ""}`}
            >
              <div className="relative">
                <MiniTree tree={t} decos={decos.filter((d) => d.tree_id === t.id)} />
                {i < 3 && t.votes_count > 0 && (
                  <span className="absolute left-1 top-1 text-lg">{["🥇", "🥈", "🥉"][i]}</span>
                )}
              </div>
              <div className="mt-1 truncate text-sm font-semibold">
                {(t.owner_id && users[t.owner_id]?.display_name) || "ไม่ระบุชื่อ"}
                {mine && <span className="ml-1 text-xs text-emerald-300">(คุณ)</span>}
              </div>
              <div className="mt-1 flex gap-1">
                <button
                  onClick={() => onView(viewingId === t.id ? null : t.id)}
                  className="flex-1 rounded-lg bg-white/15 py-1 text-xs hover:bg-white/25"
                >
                  {viewingId === t.id ? "กำลังดู" : "ดู 3D"}
                </button>
                <button
                  disabled={mine}
                  onClick={() => toggleVote(t)}
                  title={mine ? "โหวตต้นไม้ตัวเองไม่ได้" : undefined}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1 text-xs disabled:opacity-40 ${
                    myVotes.has(t.id) ? "bg-rose-500" : "bg-white/15 hover:bg-white/25"
                  }`}
                >
                  <Heart size={12} fill={myVotes.has(t.id) ? "currentColor" : "none"} />
                  {t.votes_count}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

// ---- Stocking wishes ---------------------------------------------------
function Stocking({ color, style, size = 72 }: { color: string; style: StockingStyle; size?: number }) {
  return (
    <svg viewBox="0 0 60 84" width={size} height={size * 1.4} aria-hidden>
      <path d="M14 8 h24 v38 q0 8 8 12 l8 4 q6 4 2 12 q-4 8 -14 4 l-22 -10 q-8 -4 -8 -14 z" fill={color} />
      {style === "stripe" &&
        [22, 32, 42].map((y) => (
          <rect key={y} x="14" y={y} width="24" height="4" fill="#ffffff" opacity="0.8" />
        ))}
      {style === "dots" &&
        [[22, 20], [30, 28], [22, 36], [30, 44]].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill="#ffffff" opacity="0.85" />
        ))}
      <rect x="10" y="2" width="32" height="12" rx="5" fill="#ffffff" />
    </svg>
  );
}

export function WishesWall({
  myId,
  synced,
  users,
  cheered,
  addCheered,
  onClose,
  notify,
}: {
  myId: string | null;
  synced: boolean;
  users: Record<string, DbUser>;
  cheered: Set<string>;
  addCheered: (id: string) => void;
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const [wishes, setWishes] = useState<DbWish[]>([]);
  const [seed, setSeed] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [bounce, setBounce] = useState<{ id: string; n: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [color, setColor] = useState(STOCKING_COLORS[0]);
  const [style, setStyle] = useState<StockingStyle>("plain");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let alive = true;
    sb.from("wishes")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => alive && data && setWishes(data as DbWish[]));
    const ch = sb
      .channel("wishes-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "wishes" }, (p) => {
        if (p.eventType === "DELETE") {
          const id = (p.old as { id: string }).id;
          setWishes((w) => w.filter((x) => x.id !== id));
          return;
        }
        const row = p.new as DbWish;
        setWishes((w) => {
          const i = w.findIndex((x) => x.id === row.id);
          if (i < 0) return [row, ...w];
          const c = w.slice();
          c[i] = row;
          return c;
        });
      })
      .subscribe();
    return () => {
      alive = false;
      sb.removeChannel(ch);
    };
  }, []);

  // deterministic "shuffle": order by a hash of (id, seed); seed 0 = newest first
  const visible = useMemo(() => {
    if (seed === 0) return wishes.slice(0, 12);
    const h = (s: string) => {
      let x = seed;
      for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 2654435761);
      return x >>> 0;
    };
    return [...wishes].sort((a, b) => h(a.id) - h(b.id)).slice(0, 12);
  }, [wishes, seed]);

  const open = wishes.find((w) => w.id === openId) ?? null;

  async function submit() {
    const sb = getSupabase();
    if (!sb || !myId || !msg.trim()) return;
    setSending(true);
    const { error } = await sb.from("wishes").insert({
      user_id: myId,
      message: msg.trim(),
      stocking_color: packStocking(color, style),
    });
    setSending(false);
    if (error) return notify(error.message);
    setMsg("");
    setSeed(0);
    notify("แขวนถุงเท้าคำอธิษฐานแล้ว 🧦✨");
  }

  async function cheer(w: DbWish) {
    const sb = getSupabase();
    if (!sb || cheered.has(w.id)) return;
    addCheered(w.id);
    setWishes((all) => all.map((x) => (x.id === w.id ? { ...x, cheers_count: x.cheers_count + 1 } : x)));
    await sb.rpc("cheer_wish", { p_id: w.id });
  }

  return (
    <section className={`${glass} absolute inset-x-3 bottom-24 top-28 z-30 mx-auto flex max-w-4xl flex-col overflow-hidden rounded-3xl`}>
      <header className="flex items-center justify-between px-4 py-3">
        <h3 className="font-bold">🧦 ถุงเท้าคำอธิษฐาน</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSeed(1 + Math.floor(Math.random() * 1e9));
              setOpenId(null);
            }}
            className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25"
          >
            <Shuffle size={14} /> สุ่มคำอธิษฐาน
          </button>
          <button onClick={onClose} aria-label="ปิด" className="rounded-full p-1 hover:bg-white/15">
            <X size={18} />
          </button>
        </div>
      </header>

      {/* hanging line */}
      <div className="relative px-4">
        <div className="absolute inset-x-4 top-2 h-1 rounded bg-amber-900/70" />
        <div className="flex gap-3 overflow-x-auto pb-2 pt-3">
          {visible.length === 0 && (
            <p className="w-full py-6 text-center text-sm text-white/60">ยังไม่มีคำอธิษฐาน เป็นคนแรกเลย!</p>
          )}
          {visible.map((w) => {
            const s = parseStocking(w.stocking_color);
            const active = bounce?.id === w.id;
            return (
              <button
                key={`${w.id}-${active ? bounce?.n : 0}`}
                onClick={() => {
                  setOpenId(w.id);
                  setBounce({ id: w.id, n: (bounce?.n ?? 0) + 1 });
                }}
                className={`shrink-0 origin-top ${active ? "stocking-bounce" : "hover:rotate-3"} ${
                  openId === w.id ? "drop-shadow-[0_0_10px_rgba(255,220,120,0.9)]" : ""
                }`}
                aria-label="เปิดคำอธิษฐาน"
              >
                <Stocking color={s.color} style={s.style} />
              </button>
            );
          })}
        </div>
      </div>

      {/* wish card */}
      <div className="min-h-[5.5rem] px-4 py-2">
        {open ? (
          <div className="rounded-2xl bg-white/10 p-3">
            <p className="whitespace-pre-wrap break-words text-base">“{open.message}”</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-white/70">
                — {users[open.user_id]?.display_name ?? "ไม่ระบุชื่อ"}
              </span>
              <button
                onClick={() => cheer(open)}
                disabled={cheered.has(open.id)}
                className="flex items-center gap-1 rounded-full bg-rose-500 px-3 py-1 font-semibold hover:bg-rose-400 disabled:opacity-60"
              >
                Cheer ❤️ {open.cheers_count}
              </button>
            </div>
          </div>
        ) : (
          <p className="py-3 text-center text-sm text-white/60">แตะถุงเท้าเพื่ออ่านคำอธิษฐาน</p>
        )}
      </div>

      {/* compose */}
      <div className="mt-auto border-t border-white/10 p-4">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          maxLength={280}
          rows={2}
          placeholder="เขียนคำอธิษฐานของคุณ..."
          className="w-full resize-none rounded-xl bg-white/90 p-3 text-slate-900 outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <div className="flex gap-1.5">
            {STOCKING_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={`สี ${c}`}
                className={`h-6 w-6 rounded-full border-2 ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {STOCKING_STYLES.map((s) => (
              <button
                key={s}
                onClick={() => setStyle(s)}
                className={`rounded-full px-2.5 py-1 text-xs ${style === s ? "bg-white text-slate-900" : "bg-white/15"}`}
              >
                {{ plain: "เรียบ", stripe: "ลายทาง", dots: "ลายจุด" }[s]}
              </button>
            ))}
          </div>
          <button
            onClick={submit}
            disabled={!msg.trim() || sending || !synced}
            className="ml-auto rounded-xl bg-emerald-500 px-4 py-2 font-semibold hover:bg-emerald-400 disabled:opacity-40"
          >
            แขวนถุงเท้า 🧦
          </button>
        </div>
      </div>
    </section>
  );
}
