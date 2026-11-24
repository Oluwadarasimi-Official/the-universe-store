import { saveSocialPost } from "../content-actions";
import { Submit } from "@/components/admin/client";

export default function PostForm({ s, products, campaigns, disabled }: { s?: any; products: { id: string; title: string }[]; campaigns: { id: string; name: string }[]; disabled?: boolean }) {
  const sched = s?.scheduled_for ? new Date(new Date(s.scheduled_for).getTime() + 3600000).toISOString().slice(0, 16) : "";
  return (
    <form action={saveSocialPost} className="card card-pad">
      {s?.id && <input type="hidden" name="id" value={s.id} />}
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <div className="field"><label>Channel *</label><select name="channel" className="select" defaultValue={s?.channel || "instagram"}><option value="tiktok">TikTok</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option></select></div>
          <div className="field"><label>Type</label><select name="post_type" className="select" defaultValue={s?.post_type || "caption"}><option value="caption">Caption / post</option><option value="video_script">Short video script</option><option value="carousel">Carousel</option><option value="post">Text post</option></select></div>
          <div className="field span2"><label>Caption *</label><textarea name="caption" className="textarea" defaultValue={s?.caption || ""} required maxLength={2200} /></div>
          <div className="field span2"><label>Script / slides</label><textarea name="script" className="textarea" defaultValue={s?.script || ""} /></div>
          <div className="field"><label>Hashtags</label><input name="hashtags" className="input" defaultValue={s?.hashtags || ""} /></div>
          <div className="field"><label>Product</label><select name="product_ids" className="select" defaultValue={s?.product_ids?.[0] || ""}><option value="">— none —</option>{products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          <div className="field"><label>Campaign</label><select name="campaign_id" className="select" defaultValue={s?.campaign_id || ""}><option value="">— none —</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field"><label>Planned time (WAT)</label><input name="scheduled_for" type="datetime-local" className="input" defaultValue={sched} /><span className="hint">A reminder for you — nothing is auto-posted.</span></div>
          <div className="field span2"><label>Link</label><input name="link_url" type="url" className="input" defaultValue={s?.link_url || ""} placeholder="auto: your product page with UTM tags" /></div>
          <div className="field span2"><label>Disclosure *</label><textarea name="disclosure" className="textarea" style={{ minHeight: 60 }} defaultValue={s?.disclosure || ""} placeholder="auto-filled per channel when a product or link is attached" /><span className="hint">Must be clear and visible in the post — not hidden in hashtags.</span></div>
          <div className="field span2"><label>Media notes</label><textarea name="media_notes" className="textarea" style={{ minHeight: 60 }} defaultValue={s?.media_notes || ""} /></div>
        </div>
        {!disabled && <Submit>{s?.id ? "Save" : "Create draft"}</Submit>}
      </fieldset>
    </form>
  );
}
