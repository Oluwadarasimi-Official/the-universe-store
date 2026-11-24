import { saveProduct } from "../catalog-actions";
import { Submit } from "@/components/admin/client";

export default function ProductForm({ p, cats, images, link, readOnly }: { p?: any; cats: { id: string; name: string }[]; images?: { url: string; alt_text: string }[]; link?: string | null; readOnly?: boolean }) {
  const specs = (p?.specifications || []).map((s: any) => `${s.key}: ${s.value}`).join("\n");
  const imgs = (images || []).map((i) => `${i.url} | ${i.alt_text}`).join("\n");
  return (
    <form action={saveProduct} className="card card-pad">
      {p?.id && <input type="hidden" name="id" value={p.id} />}
      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="form-grid">
          <div className="field span2"><label htmlFor="title">Title *</label><input id="title" name="title" className="input" required minLength={3} maxLength={160} defaultValue={p?.title} /></div>
          <div className="field"><label htmlFor="slug">Slug</label><input id="slug" name="slug" className="input" defaultValue={p?.slug} placeholder="auto from title" /><span className="hint">Lower-case, hyphens. Used in /p/slug.</span></div>
          <div className="field"><label htmlFor="category_id">Category *</label><select id="category_id" name="category_id" className="select" defaultValue={p?.category_id || ""}><option value="">— choose —</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="field span2"><label htmlFor="short_description">Short description *</label><textarea id="short_description" name="short_description" className="textarea" style={{ minHeight: 70 }} maxLength={300} defaultValue={p?.short_description || ""} /><span className="hint">1–2 factual sentences. Required to submit.</span></div>
          <div className="field span2"><label htmlFor="full_description">Full description</label><textarea id="full_description" name="full_description" className="textarea" defaultValue={p?.full_description || ""} /><span className="hint">Only verified facts. No invented specs, ratings or claims.</span></div>
          <div className="field"><label htmlFor="brand">Brand</label><input id="brand" name="brand" className="input" defaultValue={p?.brand || ""} /></div>
          <div className="field"><label htmlFor="retailer_name">Retailer *</label><input id="retailer_name" name="retailer_name" className="input" defaultValue={p?.retailer_name || "Jumia"} /></div>
          <div className="field span2"><label htmlFor="affiliate_url">Affiliate tracking URL</label><input id="affiliate_url" name="affiliate_url" type="url" className="input" defaultValue={link || ""} placeholder="Paste the exact link issued by your affiliate programme" /><span className="hint">Never invent or edit tracking links. Changing it resets verification. Verify it in Affiliate Links.</span></div>
          <div className="field span2"><label htmlFor="canonical_product_url">Retailer product page (optional)</label><input id="canonical_product_url" name="canonical_product_url" type="url" className="input" defaultValue={p?.canonical_product_url || ""} /></div>
          <div className="field"><label htmlFor="displayed_price">Price (as last checked)</label><input id="displayed_price" name="displayed_price" inputMode="decimal" className="input" defaultValue={p?.displayed_price ?? ""} placeholder="leave empty if unknown" /></div>
          <div className="field"><label htmlFor="currency">Currency</label><input id="currency" name="currency" className="input" maxLength={3} defaultValue={p?.currency || ""} placeholder="NGN" /></div>
          <div className="field"><label htmlFor="price_checked_at">Price last checked</label><input id="price_checked_at" name="price_checked_at" type="date" className="input" defaultValue={p?.price_checked_at?.slice(0, 10) || ""} /></div>
          <div className="field"><label htmlFor="price_source">Price source</label><input id="price_source" name="price_source" className="input" defaultValue={p?.price_source || ""} placeholder="e.g. Jumia listing, checked manually" /></div>
          <div className="field"><label htmlFor="availability_status">Availability</label><select id="availability_status" name="availability_status" className="select" defaultValue={p?.availability_status || "unknown"}><option value="unknown">Unknown (default — not shown)</option><option value="in_stock">In stock (verified)</option><option value="limited">Limited (verified)</option><option value="out_of_stock">Out of stock (verified)</option></select></div>
          <div className="field"><label htmlFor="tags">Tags</label><input id="tags" name="tags" className="input" defaultValue={(p?.tags || []).join(", ")} placeholder="comma separated" /></div>
          <div className="field span2"><label htmlFor="specifications">Key specifications (verified only)</label><textarea id="specifications" name="specifications" className="textarea" defaultValue={specs} placeholder={"Capacity: 1.7 L\nPower: 2200 W"} /><span className="hint">One per line as “Key: Value”.</span></div>
          <div className="field span2"><label htmlFor="images">Images</label><textarea id="images" name="images" className="textarea" defaultValue={imgs} placeholder="https://… | Descriptive alt text" /><span className="hint">One per line: https URL | alt text (required). Use only images you are permitted to use (your own photos or assets the programme allows).</span></div>
          <div className="field span2"><label htmlFor="source_notes">Source notes (private)</label><textarea id="source_notes" name="source_notes" className="textarea" style={{ minHeight: 70 }} defaultValue={p?.source_notes || ""} /></div>
          <div className="field span2"><label className="check"><input type="checkbox" name="is_deal" defaultChecked={p?.is_deal} /> This is a verified, current deal</label>
            <div className="form-grid"><input name="deal_note" className="input" placeholder="Deal note, e.g. 'Price drop seen on 24 Nov'" defaultValue={p?.deal_note || ""} /><input name="deal_expires_at" type="date" className="input" defaultValue={p?.deal_expires_at?.slice(0, 10) || ""} /></div>
            <span className="hint">Only shown on /deals with an end date. Saving re-stamps the “checked” time to now.</span></div>
          <label className="check span2"><input type="checkbox" name="allow_dup_title" /> Allow duplicate title</label>
        </div>
        {!readOnly && <Submit>{p?.id ? "Save changes" : "Create draft"}</Submit>}
      </fieldset>
    </form>
  );
}
