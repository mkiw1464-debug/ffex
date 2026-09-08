"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const PRICES = { "1": 3, "7": 13, "30": 27, "90": 93, "365": 199, lifetime: 999 };
const LABELS = { "1": "1 Day", "7": "7 Days", "30": "30 Days", "90": "90 Days", "365": "1 Year", lifetime: "Lifetime" };

export default function Reseller() {
  const [token, setToken]   = useState("");
  const [rows, setRows]     = useState([]);
  const [balance, setBalance] = useState(0);
  const [days, setDays]     = useState("30");
  const [qty, setQty]       = useState(1);
  const [msg, setMsg]       = useState("");
  const [busy, setBusy]     = useState(false);
  const [deviceModal, setDeviceModal] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ffex_token");
    if (!t) router.replace("/login");
    else setToken(t);
  }, [router]);

  useEffect(() => { if (token) load(); }, [token]);

  async function api(path, opts = {}) {
    const r = await fetch(path, {
      ...opts,
      headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}`, "content-type": "application/json" },
    });
    const d = await r.json();
    if (r.status === 401) { logout(); throw Error("Session expired"); }
    if (!r.ok) throw Error(d.error || "Request failed");
    return d;
  }

  async function load() {
    try {
      const d = await api("/api/licenses");
      setRows(d.licenses || []);
      setBalance(d.credit_balance || 0);
    } catch (e) { setMsg(e.message); }
  }

  async function generate() {
    const cost = PRICES[days] * Number(qty || 1);
    if (cost > balance) { setMsg(`Insufficient credit. Need ${cost}, have ${balance}.`); return; }
    setBusy(true);
    try {
      const d = await api("/api/licenses", {
        method: "POST",
        body: JSON.stringify({ days: days === "lifetime" ? null : Number(days), quantity: Number(qty) }),
      });
      setBalance(d.credit_balance);
      setMsg(`Created ${d.licenses.length} key(s) — ${d.cost} credit used`);
      load();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function action(key, actionName) {
    if (actionName === "delete" && !confirm(`Delete key ${key}?`)) return;
    if (actionName === "reset_hwid" && !confirm(`Reset HWID for ${key}? Key returns to unused.`)) return;
    try {
      const d = await api("/api/licenses", { method: "PATCH", body: JSON.stringify({ key, action: actionName }) });
      if (actionName === "reset_hwid") setMsg(d.message || "HWID reset.");
      load();
    } catch (e) { setMsg(e.message); }
  }

  async function openDevices(key) {
    try {
      const d = await api(`/api/licenses/devices?key=${encodeURIComponent(key)}`);
      setDeviceModal({ key, logs: d.logs || [], is_global: d.is_global });
    } catch (e) { setMsg(e.message); }
  }

  function logout() {
    localStorage.removeItem("ffex_token");
    localStorage.removeItem("ffex_role");
    router.replace("/login");
  }

  const active  = rows.filter(x => x.status === "active").length;
  const unused  = rows.filter(x => x.status === "unused").length;
  const cost_calc = PRICES[days] * Number(qty || 1);

  return (
    <div className="bg-shell">
      <header className="topbar">
        <div className="container nav">
          <a className="brand" href="/reseller">FF<span>EX</span></a>
          <div className="navlinks">
            <a className="telegram" href="https://t.me/ffexternal" target="_blank" rel="noreferrer">Telegram ↗</a>
            <button className="navbtn" onClick={load}>↻ Refresh</button>
            <button className="navbtn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div className="eyebrow">Reseller Dashboard</div>
          <h1 className="title">License <span>Control</span></h1>
          <p className="muted">Generate FFEX keys using your reseller credit.</p>
        </section>

        {msg && <div className="notice">{msg}</div>}

        <div className="grid">
          {/* Stats */}
          <section className="card">
            <div className="stats">
              <div className="stat accent">
                <div className="label">Credit Balance</div>
                <b style={{color:"var(--purple-hi)"}}>{balance}</b>
                <small>credits</small>
              </div>
              <div className="stat"><div className="label">Total Keys</div><b>{rows.length}</b></div>
              <div className="stat"><div className="label">Active</div><b>{active}</b></div>
              <div className="stat"><div className="label">Unused</div><b>{unused}</b></div>
            </div>
          </section>

          {/* Generate */}
          <section className="card half">
            <div className="section-title">Generate Keys</div>
            <p className="muted" style={{marginBottom:14}}>Credit deducted automatically after key creation.</p>
            <div className="pricegrid">
              {Object.entries(PRICES).map(([k, v]) => (
                <div className={`price${days === k ? " selected" : ""}`} key={k}
                  style={days === k ? {borderColor:"var(--purple)",background:"var(--purple-dim)"} : {}}
                  onClick={() => setDays(k)}>
                  <span>{LABELS[k]}</span><b>{v} cr</b>
                </div>
              ))}
            </div>
            <div className="formrow">
              <select className="input" value={days} onChange={e => setDays(e.target.value)}>
                {Object.keys(LABELS).map(k => (
                  <option value={k} key={k}>{LABELS[k]} — {PRICES[k]} cr</option>
                ))}
              </select>
              <input className="input" type="number" min="1" max="1000" value={qty}
                onChange={e => setQty(e.target.value)} placeholder="Qty" style={{maxWidth:90}} />
              <button className="btn primary" onClick={generate} disabled={busy || cost_calc > balance}>
                {busy ? "Creating…" : `Generate — ${cost_calc} cr`}
              </button>
            </div>
            {cost_calc > balance && (
              <div style={{marginTop:8,fontSize:12,color:"var(--orange)"}}>
                ⚠ Insufficient credit ({cost_calc} needed, {balance} available)
              </div>
            )}
          </section>

          {/* Pricing */}
          <section className="card half">
            <div className="section-title">Credit Pricing</div>
            <p className="muted" style={{marginBottom:14}}>Current reseller key prices.</p>
            <div className="pricinglist">
              {Object.entries(PRICES).map(([k, v]) => (
                <div key={k}>
                  <span style={{color:"var(--grey-2)"}}>{LABELS[k]}</span>
                  <strong>{v} credits</strong>
                </div>
              ))}
            </div>
          </section>

          {/* Keys table */}
          <section className="card">
            <div className="sectionhead">
              <div>
                <div className="section-title">My Keys</div>
                <p className="muted">All keys created by this reseller account.</p>
              </div>
              <span className="count">{rows.length} keys</span>
            </div>
            <KeyTable rows={rows} onAction={action} onDevices={openDevices} />
          </section>
        </div>

        <footer className="footer">
          <a href="https://t.me/ffexternal" target="_blank" rel="noreferrer">FFEXTERNAL Telegram ↗</a>
        </footer>
      </main>

      {deviceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeviceModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Device History</h2>
                <p className="muted" style={{marginTop:4}}><span className="key">{deviceModal.key}</span></p>
              </div>
              <button className="btn" onClick={() => setDeviceModal(null)}>✕ Close</button>
            </div>
            {deviceModal.logs.length === 0 ? (
              <div className="empty">No device logins recorded yet.</div>
            ) : (
              <div className="device-list">
                {deviceModal.logs.map(log => (
                  <div className="device-item" key={log.id}>
                    <div>
                      <span className="hwid-badge">{log.hwid}</span>
                      {log.ip_address && <span className="ip" style={{marginLeft:8}}>{log.ip_address}</span>}
                    </div>
                    <span className="time">{new Date(log.validated_at).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KeyTable({ rows, onAction, onDevices }) {
  return (
    <div className="tablewrap">
      <table className="table">
        <thead><tr>
          <th>License Key</th><th>Status</th><th>Duration</th><th>Expiry</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {rows.map(x => (
            <tr key={x.id}>
              <td>
                <span className="key">{x.license_key}</span>
                <button className="btn copy" style={{marginLeft:6}} onClick={() => navigator.clipboard?.writeText(x.license_key)}>Copy</button>
              </td>
              <td><span className={`pill ${x.status}`}>{x.status}</span></td>
              <td>{x.duration_days ? `${x.duration_days}d` : "Lifetime"}</td>
              <td style={{fontSize:12}}>
                {x.expires_at
                  ? new Date(x.expires_at).toLocaleString()
                  : x.duration_days ? "On activation" : "Lifetime"}
              </td>
              <td>
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  <button className="btn" onClick={() => onDevices(x.license_key)}>Devices</button>
                  {!x.is_global && x.hwid && (
                    <button className="btn warn" onClick={() => onAction(x.license_key, "reset_hwid")}>Reset HWID</button>
                  )}
                  <button className="btn" onClick={() => onAction(x.license_key, x.status === "banned" ? "unban" : "ban")}>
                    {x.status === "banned" ? "Unban" : "Ban"}
                  </button>
                  <button className="btn danger" onClick={() => onAction(x.license_key, "delete")}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan="5" className="empty">No licenses yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
