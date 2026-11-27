"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import {
  Camera,
  Droplets,
  Lightbulb,
  Pencil,
  Sprout,
  Trash2,
  Move,
  Waves,
  X,
} from "lucide-react";
import Scene from "./scene/Scene";
import DevPanel from "./DevPanel";
import { CountdownBadge, Gallery, NameModal, Toasts, WishesWall, glass } from "./Panels";
import { useUserSession } from "@/hooks/useUserSession";
import {
  useCheered,
  useCommunityTreeId,
  usePersonalTreeId,
  useTreeData,
  useUsers,
} from "@/hooks/useData";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  PRE_EVENT_WATER_HINT,
  canWaterOrFertilize,
  getEventPhase,
  getTimeOverrideActive,
  type EventPhase,
} from "@/lib/eventTime";
import { ORNAMENTS, ORNAMENT_COLORS, ornamentInfo } from "@/lib/items";
import type {
  Atmosphere,
  CameraPresetName,
  DbDeco,
  DbTree,
  Fx,
  LightMode,
  Tool,
} from "@/lib/types";

type Tab = "community" | "personal" | "gallery" | "wishes";

const TABS: { id: Tab; label: string }[] = [
  { id: "community", label: "🌲 ต้นไม้รวม" },
  { id: "personal", label: "🎄 ต้นไม้ของฉัน" },
  { id: "gallery", label: "🏆 ประกวด" },
  { id: "wishes", label: "🧦 คำอธิษฐาน" },
];
const LIGHT_CYCLE: LightMode[] = ["warm", "blink", "rainbow", "off"];
const LIGHT_LABEL: Record<LightMode, string> = {
  off: "ปิดไฟ",
  warm: "ไฟอุ่น",
  blink: "ไฟกะพริบ",
  rainbow: "ไฟรุ้ง",
};
const ATMOS: { id: Atmosphere; label: string }[] = [
  { id: "day", label: "☀️ วันหิมะ" },
  { id: "night", label: "🌙 คืนอบอุ่น" },
  { id: "aurora", label: "🌌 ออโรร่า" },
];
const PRESET_BTNS: { id: CameraPresetName; label: string }[] = [
  { id: "overview", label: "ภาพรวม" },
  { id: "tree", label: "ใกล้ต้นไม้" },
  { id: "wishes", label: "มุมคำอธิษฐาน" },
  { id: "reset", label: "รีเซ็ต" },
];

function usePhase(): [EventPhase, () => void] {
  const [p, setP] = useState<EventPhase>(() => getEventPhase());
  useEffect(() => {
    const i = setInterval(() => setP(getEventPhase()), 10000);
    return () => clearInterval(i);
  }, []);
  return [p, () => setP(getEventPhase())];
}

export default function GameApp() {
  const { userId, displayName, needsName, synced, saveName } = useUserSession();
  const [phase, refreshPhase] = usePhase();
  const users = useUsers();
  const { cheered, addCheered } = useCheered();

  const [tab, setTab] = useState<Tab>("community");
  const [viewing, setViewing] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [atmosphere, setAtmosphere] = useState<Atmosphere>("day");
  const [lightMode, setLightMode] = useState<LightMode>("warm");
  const [preset, setPreset] = useState<{ name: CameraPresetName; nonce: number }>({
    name: "overview",
    nonce: 0,
  });
  const [shakeNonce, setShakeNonce] = useState(0);
  const [fx, setFx] = useState<Fx>({ kind: "water", nonce: 0 });
  const [tool, setTool] = useState<Tool | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toastId = useRef(0);

  const push = useCallback((text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  // ---- which tree is on stage ----
  const communityId = useCommunityTreeId();
  const personalId = usePersonalTreeId(userId, synced && !!displayName, push);
  const sceneTreeId =
    viewing ?? (tab === "personal" ? personalId : communityId);

  const usersRef = useRef(users);
  useEffect(() => {
    usersRef.current = users;
  });
  const onRemoteDeco = useCallback(
    (d: DbDeco) => {
      if (d.user_id === userId) return;
      const who = usersRef.current[d.user_id]?.display_name ?? "ใครบางคน";
      push(`${ornamentInfo(d.item_type).emoji} ${who} แขวน${ornamentInfo(d.item_type).label}`);
    },
    [userId, push],
  );
  const { tree, decos, setTree, upsertDeco, removeDeco } = useTreeData(
    sceneTreeId,
    onRemoteDeco,
  );

  const canEdit =
    !!tree && !!userId && (tree.type === "community" || tree.owner_id === userId);
  const canCare = canWaterOrFertilize();
  // personal trees are always full-grown: no watering / fertilizing
  const showCare = tab !== "personal" && tree?.type !== "personal";
  const placing = canEdit && (!!tool || moving);
  const selected = decos.find((d) => d.id === selectedId) ?? null;

  // ---- realtime "events" broadcast (toasts for others' watering) ----
  const events = useRef<ReturnType<NonNullable<ReturnType<typeof getSupabase>>["channel"]> | null>(null);
  const sceneTreeRef = useRef<string | null>(null);
  useEffect(() => {
    sceneTreeRef.current = sceneTreeId;
  });
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    const ch = sb
      .channel("xmas-events")
      .on("broadcast", { event: "care" }, ({ payload }) => {
        const p = payload as { kind: "water" | "fertilize"; name: string; treeId: string };
        if (p.treeId !== sceneTreeRef.current) return;
        push(`${p.kind === "water" ? "💧" : "🌱"} ${p.name} ${p.kind === "water" ? "รดน้ำ" : "ใส่ปุ๋ย"}ต้นไม้`);
        setFx((f) => ({ kind: p.kind, nonce: f.nonce + 1 }));
      })
      .subscribe();
    events.current = ch;
    return () => {
      sb.removeChannel(ch);
      events.current = null;
    };
  }, [push]);

  // ---- Christmas Day ambience ----
  useEffect(() => {
    if (phase !== "CHRISTMAS_DAY") return;
    const end = Date.now() + 1800;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  }, [phase]);

  // ---- actions ----
  async function care(kind: "water" | "fertilize") {
    const sb = getSupabase();
    if (!sb || !tree || !userId || busy || !canEdit) return;
    if (!canCare) return push(PRE_EVENT_WATER_HINT);
    setBusy(true);
    const { data, error } = await sb.rpc("care_for_tree", {
      p_tree_id: tree.id,
      p_user_id: userId,
      p_kind: kind,
      p_dev: getTimeOverrideActive(),
    });
    setTimeout(() => setBusy(false), 900);
    if (error) return push(error.message);
    setTree(data as DbTree);
    setFx((f) => ({ kind, nonce: f.nonce + 1 }));
    confetti({
      particleCount: phase === "CHRISTMAS_DAY" ? 90 : 30,
      spread: 70,
      origin: { y: 0.85 },
      colors: kind === "water" ? ["#6fc3ff", "#bfe8ff", "#ffffff"] : ["#b6ff6a", "#ffd166", "#2a9d8f"],
    });
    push(kind === "water" ? "💧 รดน้ำแล้ว!" : "🌱 ใส่ปุ๋ยแล้ว!");
    events.current?.send({
      type: "broadcast",
      event: "care",
      payload: { kind, name: displayName, treeId: tree.id },
    });
  }

  async function handleTreeClick(p: [number, number, number]) {
    const sb = getSupabase();
    if (!sb || !tree || !userId) return;
    if (moving && selected) {
      const { data, error } = await sb
        .from("decorations")
        .update({ pos_x: p[0], pos_y: p[1], pos_z: p[2] })
        .eq("id", selected.id)
        .select()
        .single();
      if (error) return push(error.message);
      upsertDeco(data as DbDeco);
      setMoving(false);
      return push("ย้ายของประดับแล้ว");
    }
    if (!tool || !canEdit) return;
    if (!synced) return push("กำลังเตรียมข้อมูลผู้ใช้ รอสักครู่...");
    const { data, error } = await sb
      .from("decorations")
      .insert({
        tree_id: tree.id,
        user_id: userId,
        item_type: tool.type,
        color: tool.color,
        pos_x: p[0],
        pos_y: p[1],
        pos_z: p[2],
      })
      .select()
      .single();
    if (error) return push(error.message);
    upsertDeco(data as DbDeco);
  }

  // ---- contest vote for the tree on stage ----
  const [votedTrees, setVotedTrees] = useState<Record<string, boolean>>({});
  const stageTreeId = tree?.id;
  const stageIsPersonal = tree?.type === "personal";
  useEffect(() => {
    const sb = getSupabase();
    if (!sb || !userId || !stageTreeId || !stageIsPersonal) return;
    let alive = true;
    sb.from("tree_votes")
      .select("tree_id")
      .eq("tree_id", stageTreeId)
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setVotedTrees((v) => ({ ...v, [stageTreeId]: !!data }));
      });
    return () => {
      alive = false;
    };
  }, [stageTreeId, stageIsPersonal, userId]);

  async function toggleVote() {
    const sb = getSupabase();
    if (!sb || !tree || !userId || tree.type !== "personal") return;
    if (!synced) return push("กำลังเตรียมข้อมูลผู้ใช้ รอสักครู่...");
    const has = !!votedTrees[tree.id];
    const { error } = has
      ? await sb.from("tree_votes").delete().eq("tree_id", tree.id).eq("user_id", userId)
      : await sb.from("tree_votes").insert({ tree_id: tree.id, user_id: userId });
    if (error) return push(error.message);
    setVotedTrees((v) => ({ ...v, [tree.id]: !has }));
    push(has ? "ยกเลิกโหวตแล้ว" : "❤️ โหวตให้ต้นไม้นี้แล้ว!");
    if (!has) confetti({ particleCount: 40, spread: 60, origin: { y: 0.3 }, colors: ["#ff5d8f", "#ffd166"] });
  }

  async function removeSelected() {
    const sb = getSupabase();
    if (!sb || !selected) return;
    const { error } = await sb.from("decorations").delete().eq("id", selected.id);
    if (error) return push(error.message);
    removeDeco(selected.id);
    setSelectedId(null);
    setMoving(false);
  }

  async function cheerSelected() {
    const sb = getSupabase();
    if (!sb || !selected || cheered.has(selected.id)) return;
    addCheered(selected.id);
    upsertDeco({ ...selected, cheers_count: selected.cheers_count + 1 });
    await sb.rpc("cheer_decoration", { p_id: selected.id });
    confetti({ particleCount: 25, spread: 50, origin: { y: 0.6 }, scalar: 0.8, shapes: ["circle"], colors: ["#ff5d8f", "#ff9ebb"] });
  }

  function goTab(t: Tab) {
    setTab(t);
    setSelectedId(null);
    setMoving(false);
    if (t === "community" || t === "personal") setViewing(null);
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="grid h-dvh place-items-center bg-slate-900 p-6 text-center text-white">
        <div>
          <div className="text-5xl">🔧</div>
          <p className="mt-3 text-lg font-bold">ยังไม่ได้ตั้งค่า Supabase</p>
          <p className="mt-1 text-sm text-white/70">
            ใส่ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY แล้ว Redeploy
          </p>
        </div>
      </div>
    );
  }

  const owner = tree?.owner_id ? users[tree.owner_id]?.display_name : null;
  const treeTitle =
    tree?.type === "personal"
      ? tree.owner_id === userId
        ? "ต้นไม้ของฉัน"
        : `ต้นไม้ของ ${owner ?? "..."}`
      : "ต้นไม้รวมขององค์กร";

  return (
    <div className="fixed inset-0 overflow-hidden bg-slate-900 text-white">
      <Scene
        tree={tree}
        decos={decos}
        phase={phase}
        atmosphere={atmosphere}
        lightMode={lightMode}
        preset={preset}
        shakeNonce={shakeNonce}
        fx={fx}
        fullGrown={tab === "personal" || tree?.type === "personal"}
        placing={placing}
        selectedId={selectedId}
        onTreeClick={handleTreeClick}
        onSelectDeco={(id) => {
          setSelectedId(id);
          if (!id) setMoving(false);
        }}
        onPropMessage={push}
        onOpenWishes={() => goTab("wishes")}
      />

      {/* ---- top bar ---- */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className={`${glass} pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2`}>
            <span className="font-bold">🎄 Christmas Event</span>
            <span className="hidden sm:inline">
              <CountdownBadge />
            </span>
          </div>
          <button
            onClick={() => setNameOpen(true)}
            className={`${glass} pointer-events-auto flex items-center gap-2 rounded-full px-4 py-2 hover:bg-slate-800/70`}
          >
            <span className="max-w-[10rem] truncate">{displayName ?? "ตั้งชื่อ"}</span>
            <Pencil size={14} />
          </button>
        </div>
        <nav className="pointer-events-auto flex gap-1 self-start overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => goTab(t.id)}
              className={`${glass} whitespace-nowrap rounded-full px-4 py-1.5 text-sm ${
                tab === t.id ? "!bg-emerald-600 !border-emerald-300" : "hover:bg-slate-800/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 text-sm">
          <span className={`${glass} rounded-full px-3 py-1 font-semibold`}>{treeTitle}</span>
          {tree?.type === "community" && (
            <span className={`${glass} rounded-full px-3 py-1`}>
              💧 {tree.water_count} · 🌱 {tree.fertilizer_count}
            </span>
          )}
          {tree?.type === "personal" && (
            <button
              onClick={toggleVote}
              disabled={tree.owner_id === userId}
              title={tree.owner_id === userId ? "โหวตต้นไม้ตัวเองไม่ได้" : undefined}
              className={`flex items-center gap-1 rounded-full px-3 py-1 font-semibold disabled:cursor-default ${
                votedTrees[tree.id] ? "bg-rose-500" : "bg-white/20 hover:bg-white/30"
              }`}
            >
              ❤️ {tree.owner_id === userId ? "คะแนนโหวต" : votedTrees[tree.id] ? "โหวตแล้ว" : "โหวตต้นไม้นี้"} · {tree.votes_count}
            </button>
          )}
          {phase === "CHRISTMAS_DAY" && (
            <span className="rounded-full bg-amber-400 px-3 py-1 font-bold text-slate-900">
              ⭐ Merry Christmas! ต้นไม้โตเต็มที่แล้ว
            </span>
          )}
          {tab === "personal" && !personalId && (
            <span className="text-white/70">กำลังเตรียมต้นไม้ของคุณ...</span>
          )}
          {viewing && (
            <button onClick={() => setViewing(null)} className="rounded-full bg-amber-400 px-3 py-1 font-semibold text-slate-900">
              กลับต้นไม้รวม ✕
            </button>
          )}
        </div>
        <div className="sm:hidden pointer-events-auto">
          <span className={`${glass} inline-block rounded-full px-3 py-1`}>
            <CountdownBadge />
          </span>
        </div>
      </header>

      {/* ---- panels ---- */}
      {tab === "gallery" && (
        <Gallery
          myId={userId}
          users={users}
          viewingId={viewing}
          onView={setViewing}
          onClose={() => goTab("community")}
          notify={push}
        />
      )}
      {tab === "wishes" && (
        <WishesWall
          myId={userId}
          synced={synced}
          users={users}
          cheered={cheered}
          addCheered={addCheered}
          onClose={() => goTab("community")}
          notify={push}
        />
      )}

      {/* ---- selected ornament card ---- */}
      {selected && (
        <div className={`${glass} absolute bottom-40 left-3 z-30 w-64 rounded-2xl p-3`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-lg">
                {ornamentInfo(selected.item_type).emoji} {ornamentInfo(selected.item_type).label}
              </div>
              <div className="text-sm text-white/75">
                แขวนโดย {users[selected.user_id]?.display_name ?? "ไม่ระบุชื่อ"}
              </div>
            </div>
            <button onClick={() => { setSelectedId(null); setMoving(false); }} aria-label="ปิด">
              <X size={16} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              onClick={cheerSelected}
              disabled={cheered.has(selected.id)}
              className="rounded-full bg-rose-500 px-3 py-1 text-sm font-semibold disabled:opacity-60"
            >
              ❤️ {selected.cheers_count}
            </button>
            {selected.user_id === userId && (
              <>
                <button
                  onClick={() => setMoving((m) => !m)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm ${moving ? "bg-amber-400 text-slate-900" : "bg-white/15"}`}
                >
                  <Move size={13} /> {moving ? "แตะต้นไม้เพื่อวาง" : "ย้าย"}
                </button>
                <button onClick={removeSelected} className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-sm hover:bg-red-500/70">
                  <Trash2 size={13} /> ลบ
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- bottom controls ---- */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3">
        {canEdit && (
          <div className={`${glass} pointer-events-auto flex max-w-full items-center gap-3 overflow-x-auto rounded-2xl px-3 py-2`}>
            <div className="flex gap-1">
              {ORNAMENTS.map((o) => (
                <button
                  key={o.type}
                  title={o.label}
                  onClick={() =>
                    setTool((t) => (t?.type === o.type ? null : { type: o.type, color: t?.color ?? ORNAMENT_COLORS[0] }))
                  }
                  className={`grid h-11 w-11 place-items-center rounded-xl text-2xl transition ${
                    tool?.type === o.type ? "bg-amber-400/90 scale-110" : "bg-white/10 hover:bg-white/20"
                  }`}
                >
                  {o.emoji}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {ORNAMENT_COLORS.map((c) => (
                <button
                  key={c}
                  aria-label={`สี ${c}`}
                  onClick={() => setTool((t) => ({ type: t?.type ?? "bauble", color: c }))}
                  className={`h-6 w-6 rounded-full border-2 ${tool?.color === c ? "border-white scale-110" : "border-white/30"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <span className="whitespace-nowrap text-xs text-white/70">
              {tool ? "แตะที่ต้นไม้เพื่อแขวน" : "เลือกของประดับ"}
            </span>
          </div>
        )}

        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2">
          {showCare && (
          <>
          <button
            onClick={() => care("water")}
            disabled={!canEdit || busy}
            title={!canCare ? PRE_EVENT_WATER_HINT : undefined}
            className="flex items-center gap-1.5 rounded-full bg-sky-500 px-4 py-2 font-semibold shadow-lg hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Droplets size={16} /> รดน้ำ
          </button>
          <button
            onClick={() => care("fertilize")}
            disabled={!canEdit || busy}
            title={!canCare ? PRE_EVENT_WATER_HINT : undefined}
            className="flex items-center gap-1.5 rounded-full bg-lime-600 px-4 py-2 font-semibold shadow-lg hover:bg-lime-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sprout size={16} /> ใส่ปุ๋ย
          </button>
          </>
          )}
          <button
            onClick={() => setShakeNonce((n) => n + 1)}
            className={`${glass} flex items-center gap-1.5 rounded-full px-4 py-2 hover:bg-slate-800/70`}
          >
            <Waves size={16} /> เขย่าต้นไม้
          </button>
          <button
            onClick={() => setLightMode((m) => LIGHT_CYCLE[(LIGHT_CYCLE.indexOf(m) + 1) % LIGHT_CYCLE.length])}
            className={`${glass} flex items-center gap-1.5 rounded-full px-4 py-2 hover:bg-slate-800/70`}
          >
            <Lightbulb size={16} /> {LIGHT_LABEL[lightMode]}
          </button>
          <div className={`${glass} flex rounded-full p-1`}>
            {ATMOS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAtmosphere(a.id)}
                className={`rounded-full px-3 py-1 text-sm ${atmosphere === a.id ? "bg-white text-slate-900" : ""}`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className={`${glass} flex items-center gap-1 rounded-full p-1 pl-3`}>
            <Camera size={14} />
            {PRESET_BTNS.map((b) => (
              <button
                key={b.id}
                onClick={() => setPreset((p) => ({ name: b.id, nonce: p.nonce + 1 }))}
                className="rounded-full px-2.5 py-1 text-sm hover:bg-white/20"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
        {showCare && !canCare && (
          <p className="pointer-events-none rounded-full bg-black/40 px-3 py-1 text-xs text-white/90">
            {PRE_EVENT_WATER_HINT} — ตอนนี้แต่งต้นไม้และเขียนคำอธิษฐานได้เลย!
          </p>
        )}
      </footer>

      <Toasts items={toasts} />
      <DevPanel onTimeChange={refreshPhase} />

      <NameModal
        key={nameOpen ? "edit" : needsName ? "first" : "closed"}
        open={needsName || nameOpen}
        initial={displayName ?? ""}
        dismissible={!needsName}
        onSave={async (n) => {
          await saveName(n);
          setNameOpen(false);
        }}
        onClose={() => setNameOpen(false)}
      />
    </div>
  );
}
