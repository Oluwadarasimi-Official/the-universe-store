import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { A } from "@/lib/admin";
import { Head, Status } from "@/components/admin/ui";

export default async function Calendar({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole(); const sp = await searchParams;
  const now = new Date(Date.now() + 3600000); // WAT
  const ym = /^\d{4}-\d{2}$/.test(sp.m || "") ? sp.m! : now.toISOString().slice(0, 7);
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)); const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const start = new Date(first.getTime() - 3600000).toISOString(), end = new Date(Date.UTC(y, m, 1) - 3600000).toISOString();
  const { data: posts } = await adminDb().from("social_posts").select("id,channel,caption,status,scheduled_for").gte("scheduled_for", start).lt("scheduled_for", end).neq("status", "cancelled").order("scheduled_for");
  const byDay = new Map<number, any[]>();
  (posts || []).forEach((p) => { const d = new Date(new Date(p.scheduled_for).getTime() + 3600000).getUTCDate(); byDay.set(d, [...(byDay.get(d) || []), p]); });
  const offset = (first.getUTCDay() + 6) % 7;
  const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7), next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
  const today = now.toISOString().slice(0, 7) === ym ? now.getUTCDate() : -1;
  return (
    <>
      <Head title="Publishing calendar" desc="Planned social posts (WAT). These are reminders for manual posting — nothing is posted automatically.">
        <Link className="btn btn-outline btn-sm" href={A(`/calendar?m=${prev}`)}>← Prev</Link><b>{first.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })}</b><Link className="btn btn-outline btn-sm" href={A(`/calendar?m=${next}`)}>Next →</Link>
      </Head>
      <div className="cal">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="dow">{d}</div>)}
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} style={{ background: "transparent", border: 0 }} />)}
        {Array.from({ length: days }).map((_, i) => (
          <div key={i} className={i + 1 === today ? "today" : ""}><b>{i + 1}</b>
            {(byDay.get(i + 1) || []).map((p) => <Link key={p.id} href={A(`/social/${p.id}`)} style={{ display: "block", marginTop: 4 }}>{new Date(new Date(p.scheduled_for).getTime() + 3600000).toISOString().slice(11, 16)} {p.channel} <Status s={p.status} social /></Link>)}
          </div>
        ))}
      </div>
      {!posts?.length && <p className="small muted" style={{ marginTop: 12 }}>No posts planned this month. Set a planned time on a social post to see it here.</p>}
    </>
  );
}
