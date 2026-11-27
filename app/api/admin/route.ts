import { createHash, timingSafeEqual } from "node:crypto";

// Verifies the Dev-mode admin password on the server so it never ships in the
// client bundle. Set ADMIN_PASSWORD in .env.local / Vercel (server-only var).
const digest = (s: string) => createHash("sha256").update(s).digest();

export async function POST(req: Request) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return Response.json({ ok: false, error: "not-configured" }, { status: 503 });
  }
  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {}
  const ok = timingSafeEqual(digest(password), digest(expected));
  if (!ok) {
    // small delay to slow down guessing
    await new Promise((r) => setTimeout(r, 700));
    return Response.json({ ok: false }, { status: 401 });
  }
  return Response.json({ ok: true });
}
