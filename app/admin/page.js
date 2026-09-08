"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const PRICES = { "1": 3, "7": 13, "30": 27, "90": 93, "365": 199, lifetime: 999 };
const LABELS = { "1": "1 Day", "7": "7 Days", "30": "30 Days", "90": "90 Days", "365": "1 Year", lifetime: "Lifetime" };

export default function Admin() {
  const [token, setToken] = useState("");
  const [tab, setTab] = useState("keys");
  const [rows, setRows] = useState([]);
  const [resellers, setResellers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [days, setDays] = useState("30");
  const [qty, setQty] = useState(1);
  const [isGlobal, setIsGlobal] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [resUser, setResUser] = useState("");
  const [resPass, setResPass] = useState("");
  const [deviceModal, setDeviceModal] = useState(null); // { key, logs, is_global }
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem("ffex_token");
    if (!t) router.replace("/login");
    else setToken(t);
  }, [router]);

  useEffect(() => { if (token) loadKeys(); }, [token]);

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

  async function loadKeys() {
    try { setRows((await api("/api/licenses")).licenses || []); }
    catch (e) { setMsg(e.message); }
  }

  async function loadResellers() {
    try { setResellers((await api("/api/resellers")).resellers || []); }
    catch (e) { setMsg(e.message); }
  }

  async function openReseller(id) {
    try {
      setSelected(id);
      setDetail(await api(`/api/resellers?id=${encodeURIComponent(id)}`));
    } catch (e) { setMsg(e.message); }
  }

  function changeTab(next) {
    setTab(next); setMsg("");
    if (next === "resellers") loadResellers();
    else loadKeys();
  }

  async function generate() {
    setBusy(true);
    try {
      const d = await api("/api/licenses", {
        method: "POST",
        body: JSON.stringify({ days: days === "lifetime" ? null : Number(days), quantity: Number(qty), is_global: isGlobal }),
      });
      setMsg(`Created ${d.licenses.length} key(s)${isGlobal ? " [GLOBAL]" : ""}`);
      loadKeys();
    } catch (e) { setMsg(e.message); }
    finally { setBusy(false); }
  }

  async function action(key, actionName) {
    if (actionName === "delete" && !confirm(`Delete key ${key}?`)) return;
    if (actionName === "reset_hwid" && !confirm(`Reset HWID for ${key}? Key will return to unused.`)) return;
    try {
      const d = await api("/api/licenses", { method: "PATCH", body: JSON.stringify({ key, action: actionName }) });
      if (actionName === "reset_hwid") setMsg(d.message || "HWID reset.");
      loadKeys();
      if (selected) openReseller(selected);
    } catch (e) { setMsg(e.message); }
  }

  async function openDevices(key) {
    try {
      const d = await api(`/api/licenses/devices?key=${encodeURIComponent(key)}`);
      setDeviceModal({ key, logs: d.logs || [], is_global: d.is_global });
    } catch (e) { setMsg(e.message); }
  }

  async function createReseller(e) {
    e.preventDefault();
    try {
      await api("/api/resellers", { method: "POST", body: JSON.stringify({ username: resUser, password: resPass }) });
      setResUser(""); setResPass("");
      setMsg("Reseller created"); loadResellers();
    } catch (e) { setMsg(e.message); }
  }

  async function addCredit(id, username) {
    const raw = window.prompt(`Add credit to ${username}:`, "100");
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) { setMsg("Enter a valid credit amount"); return; }
    try {
      const d = await api("/api/resellers", { method: "PATCH", body: JSON.stringify({ id, amount }) });
      setMsg(`Added ${Math.floor(amount)} credit to ${username}. Balance: ${d.credit_balance}`);
      loadResellers();
      if (selected === id) openReseller(id);
    } catch (e) { setMsg(e.message); }
  }

  function logout() {
    localStorage.removeItem("ffex_token");
    localStorage.removeItem("ffex_role");
    router.replace("/login");
  }

  const active  = rows.filter(x => x.status === "active").length;
  const unused  = rows.filter(x => x.status === "unused").length;
  const expired = rows.filter(x => x.status === "expired").length;
  const globals = rows.filter(x => x.is_global).length;

  return (
    <div className="bg-shell">
      <header className="topbar">
        <div className="container nav">
          <a className="brand" href="/admin">FF<span>EX</span></a>
          <div className="navlinks">
            <a className="telegram" href="https://t.me/ffexternal" target="_blank" rel="noreferrer">Telegram ↗</a>
            <button className="navbtn" onClick={() => tab === "resellers" ? loadResellers() : loadKeys()}>↻ Refresh</button>
            <button className="navbtn" onClick={logout}>Logout</button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <div className="eyebrow">Administrator Dashboard</div>
          <h1 className="title">License <span>Control</span></h1>
          <p className="muted">Manage keys, resellers, and credit from any device.</p>
        </section>

        <div className="tabs">
          <button className={tab === "keys" ? "tab active" : "tab"} onClick={() => changeTab("keys")}>Keys</button>
          <button className={tab === "resellers" ? "tab active" : "tab"} onClick={() => changeTab("resellers")}>Resellers</button>
        </div>

        {msg && <div className="notice">{msg}</div>}

        {tab === "keys" ? (
          <div className="grid">
            {/* Stats */}
            <section className="card">
              <div className="stats">
                <div className="stat"><div className="label">Total Keys</div><b>{rows.length}</b></div>
                <div className="stat accent"><div className="label">Active</div><b>{active}</b></div>
                <div className="stat"><div className="label">Unused</div><b>{unused}</b></div>
                <div className="stat"><div className="label">Expired</div><b>{expired}</b></div>
              </div>
            </section>

            {/* Generate */}
            <section className="card half">
              <div className="section-title">Generate Keys</div>
              <p className="muted" style={{marginBottom:14}}>Admin keys are free. Global keys allow unlimited devices.</p>
              <div className="pricegrid">
                {Object.entries(PRICES).map(([k, v]) => (
                  <div className="price" key={k}><span>{LABELS[k]}</span><b>{v} cr</b></div>
                ))}
              </div>
              <div className="formrow" style={{marginBottom:10}}>
                <select className="input" value={days} onChange={e => setDays(e.target.value)}>
                  {Object.keys(LABELS).map(k => <option value={k} key={k}>{LABELS[k]}</option>)}
                </select>
                <input className="input" type="number" min="1" max="1000" value={qty}
                  onChange={e => setQty(e.target.value)} placeholder="Qty" style={{maxWidth:90}} />
                <button className="btn primary" onClick={generate} disabled={busy}>
                  {busy ? "Creating…" : "Generate"}
                </button>
              </div>
              {/* Global key toggle — admin only */}
              <div className="global-toggle-row" onClick={() => setIsGlobal(g => !g)}>
                <input type="checkbox" checked={isGlobal} onChange={() => {}} />
                <label>Global Key</label>
                <small>— unlimited devices, no HWID lock</small>
              </div>
              {globals > 0 && (
                <div style={{marginTop:10,fontSize:13,color:"var(--purple-hi)"}}>
                  ∞ {globals} global key{globals === 1 ? "" : "s"} in database
                </div>
              )}
            </section>

            {/* Create reseller */}
            <section className="card half">
              <div className="section-title">Create Reseller</div>
              <p className="muted" style={{marginBottom:14}}>New reseller starts with 0 credit.</p>
              <form className="formrow" onSubmit={createReseller}>
                <input className="input" placeholder="Username" value={resUser} onChange={e => setResUser(e.target.value)} required />
                <input className="input" placeholder="Password (8+ chars)" type="password" minLength="8" value={resPass} onChange={e => setResPass(e.target.value)} required />
                <button className="btn primary">Create</button>
              </form>
            </section>

            {/* All keys */}
            <section className="card">
              <div className="sectionhead">
                <div>
                  <div className="section-title">All Keys</div>
                  <p className="muted">Full key inventory with HWID controls.</p>
                </div>
                <span className="count">{rows.length} keys</span>
              </div>
              <KeyTable rows={rows} onAction={action} onDevices={openDevices} />
            </section>
          </div>
        ) : (
          <>
            <section className="card">
              <div className="sectionhead">
                <div>
                  <div className="section-title">Reseller Accounts</div>
                  <p className="muted">Click a reseller to see full account status.</p>
                </div>
                <span className="count">{resellers.length} reseller{resellers.length === 1 ? "" : "s"}</span>
              </div>
              <div className="tablewrap">
                <table className="table">
                  <thead><tr>
                    <th>Reseller</th><th>Credit</th><th>Total</th><th>Active</th><th>Unused</th><th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {resellers.map(r => (
                      <tr key={r.id}>
                        <td>
                          <button className="linkbtn" onClick={() => openReseller(r.id)}>{r.username}</button>
                          <small className="subline">Joined {new Date(r.created_at).toLocaleDateString()}</small>
                        </td>
                        <td><strong style={{color:"var(--purple-hi)"}}>{r.credit_balance}</strong> <span style={{color:"var(--grey-4)"}}>cr</span></td>
                        <td>{r.total_keys}</td>
                        <td>{r.active_keys}</td>
                        <td>{r.unused_keys}</td>
                        <td style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <button className="btn" onClick={() => addCredit(r.id, r.username)}>+ Credit</button>
                          <button className="btn primary" onClick={() => openReseller(r.id)}>View</button>
                        </td>
                      </tr>
                    ))}
                    {!resellers.length && <tr><td colSpan="6" className="empty">No resellers yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            {detail && (
              <section className="card detailcard">
                <div className="sectionhead">
                  <div>
                    <div className="eyebrow">Reseller Details</div>
                    <h2 style={{margin:0}}>{detail.reseller.username}</h2>
                  </div>
                  <button className="btn" onClick={() => setDetail(null)}>✕ Close</button>
                </div>
                <div className="detailstats">
                  <div><span>Credit</span><b style={{color:"var(--purple-hi)"}}>{detail.reseller.credit_balance}</b></div>
                  <div><span>Total</span><b>{detail.licenses.length}</b></div>
                  <div><span>Active</span><b>{detail.licenses.filter(x => x.status === "active").length}</b></div>
                  <div><span>Unused</span><b>{detail.licenses.filter(x => x.status === "unused").length}</b></div>
                  <div><span>Expired</span><b>{detail.licenses.filter(x => x.status === "expired").length}</b></div>
                  <div><span>Banned</span><b>{detail.licenses.filter(x => x.status === "banned").length}</b></div>
                </div>
                <div className="detailactions">
                  <button className="btn primary" onClick={() => addCredit(detail.reseller.id, detail.reseller.username)}>+ Add Credit</button>
                  <span className="muted">Created {new Date(detail.reseller.created_at).toLocaleString()}</span>
                </div>
                <KeyTable rows={detail.licenses} onAction={async (key, a) => { await action(key, a); openReseller(detail.reseller.id); }} onDevices={openDevices} />
              </section>
            )}
          </>
        )}

        <footer className="footer">
          <a href="https://t.me/ffexternal" target="_blank" rel="noreferrer">FFEXTERNAL Telegram ↗</a>
        </footer>
      </main>

      {/* Device history modal */}
      {deviceModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDeviceModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <div>
                <h2>Device History</h2>
                <p className="muted" style={{marginTop:4}}>
                  <span className="key">{deviceModal.key}</span>
                  {deviceModal.is_global && <span className="global-badge">GLOBAL</span>}
                </p>
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
          <th>License Key</th><th>Type</th><th>Status</th><th>Duration</th><th>Expiry</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {rows.map(x => (
            <tr key={x.id}>
              <td>
                <span className="key">{x.license_key}</span>
                <button className="btn copy" style={{marginLeft:6}} onClick={() => navigator.clipboard?.writeText(x.license_key)}>Copy</button>
              </td>
              <td>
                {x.is_global
                  ? <span className="pill global">∞ Global</span>
                  : <span style={{color:"var(--grey-4)",fontSize:12}}>Single</span>}
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
          {!rows.length && <tr><td colSpan="6" className="empty">No licenses yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
