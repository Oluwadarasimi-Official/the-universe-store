import { requireRole } from "@/lib/auth";
import { adminDb } from "@/lib/supabase/clients";
import { Flash, Head } from "@/components/admin/ui";
import ProductForm from "../ProductForm";

export default async function NewProduct({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireRole(["owner", "editor"]);
  const sp = await searchParams;
  const { data: cats } = await adminDb().from("categories").select("id,name").order("sort_order");
  return (<><Head title="New product" desc="Creates a draft. It stays private until submitted, approved and published." /><Flash sp={sp} /><ProductForm cats={cats || []} /></>);
}
