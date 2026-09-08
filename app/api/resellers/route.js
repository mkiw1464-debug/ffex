import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "../../../lib/supabase";
import { getBearer, verifyToken } from "../../../lib/auth";

const hash = s => crypto.createHash("sha256").update(s).digest("hex");

async function adminOnly(req) {
  const t = getBearer(req);
  const u = t ? await verifyToken(t) : null;
  return u?.role === "admin" ? u : null;
}

export async function GET(req) {
  const u = await adminOnly(req);
  if (!u) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const user = await supabase.from("users").select("id,username,role,credit_balance,created_at").eq("id", id).eq("role", "reseller").maybeSingle();
    if (user.error) return NextResponse.json({ error: user.error.message }, { status: 500 });
    if (!user.data) return NextResponse.json({ error: "Reseller not found" }, { status: 404 });

    const keys = await supabase.from("licenses").select("*").eq("created_by", id).order("created_at", { ascending: false });
    if (keys.error) return NextResponse.json({ error: keys.error.message }, { status: 500 });
    return NextResponse.json({ reseller: user.data, licenses: keys.data || [] });
  }

  const users = await supabase.from("users").select("id,username,role,credit_balance,created_at").eq("role", "reseller").order("created_at", { ascending: false });
  if (users.error) return NextResponse.json({ error: users.error.message }, { status: 500 });

  const keys = await supabase.from("licenses").select("id,created_by,status,duration_days");
  if (keys.error) return NextResponse.json({ error: keys.error.message }, { status: 500 });

  const list = (users.data || []).map(r => {
    const mine = (keys.data || []).filter(k => k.created_by === r.id);
    return {
      ...r,
      total_keys: mine.length,
      active_keys: mine.filter(k => k.status === "active").length,
      unused_keys: mine.filter(k => k.status === "unused").length,
      expired_keys: mine.filter(k => k.status === "expired").length,
      banned_keys: mine.filter(k => k.status === "banned").length,
    };
  });

  return NextResponse.json({ resellers: list });
}

export async function POST(req) {
  const u = await adminOnly(req);
  if (!u) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { username, password } = await req.json();
  if (!username || !password || password.length < 8) {
    return NextResponse.json({ error: "Username and password (8+ chars) required" }, { status: 400 });
  }

  const { data, error } = await supabase.from("users")
    .insert({ username, password_hash: hash(password), role: "reseller" })
    .select("id,username,role,credit_balance,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ reseller: data });
}

export async function PATCH(req) {
  const u = await adminOnly(req);
  if (!u) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { id, amount } = await req.json();
  const value = Math.floor(Number(amount));
  if (!id || !Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: "Credit amount must be a positive number" }, { status: 400 });
  }

  const result = await supabase.rpc("increment_reseller_credit", { p_user_id: id, p_amount: value });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, credit_balance: result.data });
}
