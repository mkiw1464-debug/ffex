"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "Login failed");
      localStorage.setItem("ffex_token", d.token);
      localStorage.setItem("ffex_role", d.role);
      router.push(d.role === "admin" ? "/admin" : "/reseller");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <main className="login">
      <section className="loginbox">
        <div className="eyebrow">License Control Center</div>
        <h1 className="title" style={{fontSize:32}}>FF<span>EX</span> <span style={{color:"var(--grey-3)",fontWeight:400,fontSize:22}}>License</span></h1>
        <p className="muted">Sign in to manage your keys securely.</p>
        <form onSubmit={submit}>
          <input
            className="input"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button className="btn primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          {error && <div className="notice err">{error}</div>}
        </form>
        <a className="logintelegram" href="https://t.me/ffexternal" target="_blank" rel="noreferrer">
          Join FFEXTERNAL on Telegram ↗
        </a>
      </section>
    </main>
  );
}
