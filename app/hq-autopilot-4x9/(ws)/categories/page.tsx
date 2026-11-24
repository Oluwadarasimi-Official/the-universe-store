import { requireRole, canEdit } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Empty, Flash, Head } from "@/components/admin/ui";
import { Submit } from "@/components/admin/client";
import { saveCategory, categoryAction } from "../catalog-actions";

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const me = await requireRole(); const sp = await searchParams;
  const db = adminDb();
  const [{ data: cats }, { data: prods }] = await Promise.all([db.from("categories").select("*").order("sort_order").order("name"), db.from("products").select("category_id")]);
  const n = (id: string) => (prods || []).filter((p) => p.category_id === id).length;
  const edit = canEdit(me.role), owner = me.role === "owner";
  return (
    <>
      <Head title="Categories" desc="Add, rename, reorder, hide or remove categories. Age-restricted or unsafe categories are blocked." />
      <Flash sp={sp} />
      {edit && (
        <details className="box" style={{ marginBottom: 16 }}><summary>Add a category</summary>
          <form action={saveCategory} className="form-grid" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="n">Name *</label><input id="n" name="name" className="input" required /></div>
            <div className="field"><label htmlFor="s">Slug</label><input id="s" name="slug" className="input" placeholder="auto" /></div>
            <div className="field span2"><label htmlFor="i">Introduction</label><textarea id="i" name="intro" className="textarea" style={{ minHeight: 70 }} /></div>
            <div className="field"><label htmlFor="ic">Icon (emoji, optional)</label><input id="ic" name="icon" className="input" maxLength={4} /></div>
            <div className="field"><label htmlFor="o">Sort order</label><input id="o" name="sort_order" type="number" className="input" defaultValue={100} /></div>
            <label className="check"><input type="checkbox" name="visible" defaultChecked /> Visible on the store</label>
            <div className="span2"><Submit>Add category</Submit></div>
          </form>
        </details>
      )}
      {cats?.length ? (
        <div className="stack">{cats.map((c) => (
          <details key={c.id} className="box">
            <summary>{c.icon} {c.name} <span className="muted small">/{c.slug} · {n(c.id)} product(s) · order {c.sort_order}</span> {!c.visible && <span className="badge badge-gray">Hidden</span>} {c.is_demo && <span className="badge badge-demo">Demo</span>}</summary>
            {edit && <form action={saveCategory} className="form-grid" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={c.id} />
              <div className="field"><label>Name</label><input name="name" className="input" defaultValue={c.name} /></div>
              <div className="field"><label>Slug</label><input name="slug" className="input" defaultValue={c.slug} /></div>
              <div className="field span2"><label>Introduction</label><textarea name="intro" className="textarea" style={{ minHeight: 70 }} defaultValue={c.intro || ""} /></div>
              <div className="field"><label>Icon</label><input name="icon" className="input" defaultValue={c.icon || ""} maxLength={4} /></div>
              <div className="field"><label>Sort order</label><input name="sort_order" type="number" className="input" defaultValue={c.sort_order} /></div>
              <label className="check"><input type="checkbox" name="visible" defaultChecked={c.visible} /> Visible</label>
              <div className="span2"><Submit className="btn btn-primary btn-sm">Save</Submit></div>
            </form>}
            {owner && <div className="row" style={{ marginTop: 8 }}>
              {["up", "down", "toggle"].map((to) => <form key={to} action={categoryAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value={to} /><Submit className="btn btn-outline btn-sm">{to === "up" ? "Move up" : to === "down" ? "Move down" : c.visible ? "Hide" : "Show"}</Submit></form>)}
              <form action={categoryAction}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="to" value="delete" /><Submit className="btn btn-danger btn-sm" confirm={`Delete category "${c.name}"?`}>Delete</Submit></form>
            </div>}
          </details>
        ))}</div>
      ) : <Empty title="No categories yet"><p className="muted small">Add one above, or load the starter categories from Settings.</p></Empty>}
    </>
  );
}
