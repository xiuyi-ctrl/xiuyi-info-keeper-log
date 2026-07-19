import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createItem } from "@/lib/repositories";
import { ItemForm, emptyForm, type ItemFormValues } from "@/components/ItemForm";

export const Route = createFileRoute("/_authenticated/items/new")({
  component: NewItem,
});

function NewItem() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(v: ItemFormValues): Promise<void> {
    setSubmitting(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setSubmitting(false);
      return;
    }
    try {
      const id = await createItem({
        user_id: userData.user.id,
        name: v.name.trim(),
        category: v.category,
        tags: v.tags,
        account: v.account || null,
        password_hint: v.password_hint || null,
        phone: v.phone || null,
        email: v.email || null,
        notes: v.notes || null,
        extra: v.extra ?? {},
      });
      qc.invalidateQueries({ queryKey: ["items"] });
      toast.success("已保存");
      navigate({ to: "/items/$id", params: { id } });
    } catch (e) {
      toast.error("保存失败", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/items"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" /> 返回列表
      </Link>
      <h1 className="text-3xl font-bold">新建条目</h1>
      <ItemForm
        initial={emptyForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel="保存"
      />
    </div>
  );
}
