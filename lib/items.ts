import type { ItemType } from "./types";

export const ORNAMENTS: { type: ItemType; label: string; emoji: string }[] = [
  { type: "bauble", label: "ลูกบอล", emoji: "🔴" },
  { type: "candy_cane", label: "ไม้เท้าลูกอม", emoji: "🍭" },
  { type: "star", label: "ดาว", emoji: "⭐" },
  { type: "gift", label: "ของขวัญ", emoji: "🎁" },
  { type: "bell", label: "กระดิ่ง", emoji: "🔔" },
];

export const ornamentInfo = (t: ItemType) =>
  ORNAMENTS.find((o) => o.type === t) ?? ORNAMENTS[0];

export const ORNAMENT_COLORS = [
  "#e63946",
  "#f4a261",
  "#ffd166",
  "#2a9d8f",
  "#4cc9f0",
  "#b388eb",
  "#ff7eb6",
  "#ffffff",
];

export const STOCKING_COLORS = [
  "#d62828",
  "#2a9d8f",
  "#3a86ff",
  "#ff7eb6",
  "#f4a261",
  "#8338ec",
];
export const STOCKING_STYLES = ["plain", "stripe", "dots"] as const;
export type StockingStyle = (typeof STOCKING_STYLES)[number];

/** The schema has a single `stocking_color` text column; style is packed as "color|style". */
export const packStocking = (color: string, style: StockingStyle) =>
  `${color}|${style}`;
export function parseStocking(raw: string): {
  color: string;
  style: StockingStyle;
} {
  const [c, s] = raw.split("|");
  const style = (STOCKING_STYLES as readonly string[]).includes(s)
    ? (s as StockingStyle)
    : "plain";
  return { color: c || "#d62828", style };
}

export const PROP_MESSAGES = {
  gift: [
    "🎁 ของขวัญกล่องนี้... ว่างเปล่า แต่เต็มไปด้วยความตั้งใจ!",
    "🎁 ห้ามแอบเปิดก่อนวันที่ 25 นะ!",
    "🎁 เขย่าดูแล้ว ได้ยินเสียงกริ๊งๆ",
  ],
  snowman: [
    "⛄ สวัสดี! ผมชื่อ โอลาฟ... เอ๊ย สโนว์แมน",
    "⛄ ช่วยหาแครอทให้หน่อยได้ไหม?",
    "⛄ อากาศกำลังดี ไม่ละลายหรอก!",
  ],
  fire: [
    "🔥 ไฟอุ่นๆ ช่วยให้ใจอบอุ่นด้วย",
    "🔥 เปรี๊ยะ! ประกายไฟลอยขึ้นฟ้า",
    "🔥 มาผิงไฟด้วยกันไหม?",
  ],
  mantel: ["🧦 ไปเขียนคำอธิษฐานกันเถอะ!"],
};
