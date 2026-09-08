import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";
import { getBearer, verifyToken } from "../../../../lib/auth";
import { normalizeKey } from "../../../../lib/license";

async function auth(req) {
  const t = getBearer(req);
  return t ? await verifyToken(t) : null;
}

// GET /api/licenses/devices?key=FFEX-XXXX
export async function GET(req) {
  const u = await auth(req);
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const k = normalizeKey(searchParams.get("key") || "");
  if (!k) return NextResponse.json({ error: "Key required" }, { status: 400 });

  const { data: lic, error: licErr } = await supabase
    .from("licenses")
    .select("id, created_by, is_global")
    .eq("license_key", k)
    .maybeSingle();

  if (licErr) return NextResponse.json({ error: licErr.message }, { status: 500 });
  if (!lic) return NextResponse.json({ error: "Key not found" }, { status: 404 });
  if (u.role === "reseller" && lic.created_by !== u.sub)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: logs, error: logErr } = await supabase
    .from("device_logs")
    .select("id, hwid, ip_address, validated_at")
    .eq("license_id", lic.id)
    .order("validated_at", { ascending: false })
    .limit(100);

  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 });

  return NextResponse.json({ logs: logs || [], is_global: lic.is_global });
}
