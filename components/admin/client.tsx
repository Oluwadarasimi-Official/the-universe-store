"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";

export function Submit({ children, className = "btn btn-primary", confirm: msg, name, value }: { children: React.ReactNode; className?: string; confirm?: string; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending} name={name} value={value}
      onClick={(e) => { if (msg && !window.confirm(msg)) e.preventDefault(); }}>
      {pending ? "Working…" : children}
    </button>
  );
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(text); } catch {
        const t = document.createElement("textarea"); t.value = text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
      }
      setDone(true); setTimeout(() => setDone(false), 1500);
    }}>{done ? "Copied ✓" : label}</button>
  );
}

export function DownloadButton({ text, filename, label = "Download .txt" }: { text: string; filename: string; label?: string }) {
  return (
    <button type="button" className="btn btn-outline btn-sm" onClick={() => {
      const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }}>{label}</button>
  );
}

/* Checks URL *format* only. Never marks a link valid.
   trackingId is the AliExpress tracking ID from Settings (falls back to
   "default", the account's only ID, when Settings has none); when set, an
   AliExpress link is expected to carry it. */
export function LinkFormatTester({ initial = "", trackingId = "" }: { initial?: string; trackingId?: string }) {
  const [u, setU] = useState(initial);
  let msg = "", ok = false;
  if (u) {
    try {
      const x = new URL(u);
      const host = x.hostname.replace(/^www\./, "");
      const issues: string[] = [];
      const isAli = /(^|\.)aliexpress\.com$/.test(host);
      const isAliShort = host === "s.click.aliexpress.com";
      if (x.protocol !== "https:") issues.push("not HTTPS");
      if (!isAli) issues.push(`host is ${host} (not an AliExpress domain)`);
      if (isAli && !isAliShort) {
        if (!x.search) issues.push("no query parameters — AliExpress tracking links carry tracking parameters; confirm this is the link the AliExpress portal issued");
        else if (trackingId && !u.includes(trackingId)) issues.push(`does not contain your AliExpress tracking ID (${trackingId}) — confirm this link was generated under your affiliate account`);
      }
      ok = issues.length === 0;
      msg = ok ? `Format looks OK (${host}). This does NOT prove the link works or tracks — open it and confirm in your affiliate dashboard, then mark it verified.` : `Check: ${issues.join("; ")}.`;
    } catch { msg = "Not a valid URL."; }
  }
  return (
    <div className="field">
      <label htmlFor="fmt">Test a URL&apos;s format</label>
      <input id="fmt" className="input" value={u} onChange={(e) => setU(e.target.value)} placeholder="https://…" />
      {msg && <span className={ok ? "hint" : "err"}>{msg}</span>}
    </div>
  );
}
