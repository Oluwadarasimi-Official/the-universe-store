"use client";
import { useActionState, useEffect, useState } from "react";
import { submitContact, type ContactState } from "./actions";

export default function ContactForm({ kind, product }: { kind?: string; product?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, {});
  const [t, setT] = useState(0);
  useEffect(() => setT(Date.now()), []);
  if (state.ok) return <div className="notice notice-ok" role="status"><b>Thank you.</b> Your message has been received.</div>;
  const f = state.fields || {};
  return (
    <form action={action} className="card card-pad" noValidate>
      {state.error && <div className="notice notice-err" role="alert" style={{ marginBottom: 14 }}>{state.error}</div>}
      <div className="field"><label htmlFor="kind">What is this about?</label>
        <select id="kind" name="kind" className="select" defaultValue={f.kind || kind || "contact"}>
          <option value="contact">General message</option><option value="broken_link">Report a broken link</option><option value="incorrect_info">Report incorrect product information</option>
        </select></div>
      <div className="form-grid">
        <div className="field"><label htmlFor="name">Name <span className="muted">(optional)</span></label><input id="name" name="name" className="input" defaultValue={f.name} maxLength={120} autoComplete="name" /></div>
        <div className="field"><label htmlFor="email">Email <span className="muted">(optional, if you want a reply)</span></label><input id="email" name="email" type="email" className="input" defaultValue={f.email} maxLength={200} autoComplete="email" /></div>
      </div>
      {(product || f.product) && <input type="hidden" name="product" value={product || f.product} />}
      <div className="field"><label htmlFor="message">Message</label><textarea id="message" name="message" className="textarea" required minLength={5} maxLength={4000} defaultValue={f.message} /></div>
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <input type="hidden" name="t" value={t} />
      <button className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      <p className="xs muted" style={{ marginTop: 10 }}>We only store what you type here, to reply or fix the issue. See our privacy policy.</p>
    </form>
  );
}
