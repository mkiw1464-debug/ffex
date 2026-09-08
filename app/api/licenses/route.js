import { NextResponse } from "next/server";
import { supabase } from "../../../lib/supabase";
import { getBearer, verifyToken } from "../../../lib/auth";
import { generateLicenseKey, normalizeKey } from "../../../lib/license";

const PRICES = { "1": 3, "7": 13, "30": 27, "90": 93, "365": 199, lifetime: 999 };

async function auth(req) {
  const t = getBearer(req);
  return t ? await verifyToken(t) : null;
}

export async function GET(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let q = supabase.from("licenses").select("*").order("created_at", { ascending: false });
  if (u.role === "reseller") q = q.eq("created_by", u.sub);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = new Date().toISOString();
  const expired = (data || [])
    .filter((x) => x.expires_at && x.expires_at <= now && x.status === "active")
    .map((x) => x.id);

  if (expired.length) {
    await supabase.from("licenses").update({ status: "expired" }).in("id", expired);
  }

  let credit_balance = null;
  if (u.role === "reseller") {
    const user = await supabase.from("users").select("credit_balance").eq("id", u.sub).maybeSingle();
    credit_balance = user.data?.credit_balance ?? 0;
  }

  return NextResponse.json({
    licenses: (data || []).map((x) => (expired.includes(x.id) ? { ...x, status: "expired" } : x)),
    credit_balance,
    prices: PRICES,
  });
}

export async function POST(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const quantity = Math.min(Math.max(Math.floor(Number(body.quantity || 1)), 1), 1000);
  const duration =
    body.days === null || body.days === undefined || body.days === "" ? "lifetime" : String(body.days);
  const price = PRICES[duration];
  if (price === undefined) return NextResponse.json({ error: "Invalid duration" }, { status: 400 });

  // Global key: admin-only
  const isGlobal = body.is_global === true || body.is_global === "true";
  if (isGlobal && u.role !== "admin") {
    return NextResponse.json({ error: "Only admin can create global keys" }, { status: 403 });
  }

  const cost = price * quantity;
  let newBalance = null;

  if (u.role === "reseller") {
    const debit = await supabase.rpc("decrement_reseller_credit", {
      p_user_id: u.sub,
      p_amount: cost,
    });
    if (debit.error) {
      const message = debit.error.message?.toLowerCase().includes("insufficient")
        ? `Insufficient credit. Need ${cost} credit.`
        : debit.error.message;
      return NextResponse.json({ error: message }, { status: 400 });
    }
    newBalance = debit.data;
  }

  const days = duration === "lifetime" ? null : Number(duration);
  const out = [];
  for (let i = 0; i < quantity; i++) {
    out.push({
      license_key: generateLicenseKey(),
      created_by: u.role === "reseller" ? u.sub : null,
      duration_days: days,
      expires_at: null,
      status: "unused",
      is_global: isGlobal,
    });
  }

  const { data, error } = await supabase.from("licenses").insert(out).select("*");
  if (error) {
    if (u.role === "reseller") {
      await supabase.rpc("increment_reseller_credit", { p_user_id: u.sub, p_amount: cost });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ licenses: data, cost, credit_balance: newBalance });
}

export async function PATCH(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { key, action } = await req.json();
  const k = normalizeKey(key);
  if (!k) return NextResponse.json({ error: "Key required" }, { status: 400 });

  const { data, error } = await supabase.from("licenses").select("*").eq("license_key", k).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  if (u.role === "reseller" && data.created_by !== u.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (action === "delete") {
    const r = await supabase.from("licenses").delete().eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ban" || action === "unban") {
    const status =
      action === "ban"
        ? "banned"
        : data.expires_at && new Date(data.expires_at) <= new Date()
        ? "expired"
        : data.activated_at
        ? "active"
        : "unused";
    const r = await supabase.from("licenses").update({ status }).eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, status });
  }

  // Reset HWID — admin only or reseller who owns the key
  if (action === "reset_hwid") {
    const r = await supabase
      .from("licenses")
      .update({ hwid: null, status: data.status === "active" ? "unused" : data.status, activated_at: null, expires_at: null })
      .eq("id", data.id);
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 });
    // Also clear device_logs for this key
    await supabase.from("device_logs").delete().eq("license_id", data.id);
    return NextResponse.json({ ok: true, message: "HWID reset. Key is now unused." });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
