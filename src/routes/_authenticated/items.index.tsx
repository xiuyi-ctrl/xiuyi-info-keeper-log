import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, Eye, EyeOff, Copy, Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCategory, getAllCategories, maskValue, type Item } from "@/lib/vault";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/items/")({
  component: ItemsList,
});

function ItemsList() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: ["items", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    items.forEach((i) => i.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((i) => {
      if (cat !== "all" && i.category !== cat) return false;
      if (tag !== "all" && !(i.tags ?? []).includes(tag)) return false;
      if (!query) return true;
      return (
        i.name.toLowerCase().includes(query) ||
        (i.notes ?? "").toLowerCase().includes(query)
      );
    });
  }, [items, q, cat, tag]);

  const cats = getAllCategories();

  async function copyText(id: string, v: string) {
    try {
      await navigator.clipboard.writeText(v);
      setCopied(id);
      toast.success("已复制到剪贴板");
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("复制失败");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">全部条目</h1>
          <p className="mt-1 text-sm text-muted-foreground">共 {filtered.length} 条</p>
        </div>
        <Link to="/items/new">
          <Button className="gradient-accent-bg text-primary-foreground"><Plus className="mr-1 h-4 w-4" /> 新建条目</Button>
        </Link>
      </div>

      <div className="panel p-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="全局秒搜：按名称或备注模糊搜索…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={cat === "all"} onClick={() => setCat("all")}>全部分类</Chip>
          {cats.map((c) => (
            <Chip key={c.key} active={cat === c.key} onClick={() => setCat(c.key)} color={c.color}>
              <c.icon className="mr-1 h-3.5 w-3.5" /> {c.label}
            </Chip>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Chip active={tag === "all"} onClick={() => setTag("all")}>全部标签</Chip>
            {allTags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(t)}>#{t}</Chip>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground">加载中…</div>
      ) : filtered.length === 0 ? (
        <div className="panel py-20 text-center">
          <p className="text-muted-foreground">没有匹配的记录</p>
          <Link to="/items/new" className="mt-4 inline-block text-vault hover:underline">新建第一条 →</Link>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((it) => {
            const c = getCategory(it.category);
            const isRevealed = reveal[it.id];
            return (
              <div key={it.id} className="panel group flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/items/$id" params={{ id: it.id }} className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md" style={{ background: `${c.color}22`, color: c.color }}>
                      <c.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{it.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                    </div>
                  </Link>
                </div>

                {it.account && (
                  <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0">账号</span>
                    <span className="flex-1 truncate font-mono text-xs">{it.account}</span>
                    <button
                      onClick={() => copyText(it.id + "acc", it.account!)}
                      className="text-muted-foreground hover:text-vault"
                      title="复制账号"
                    >
                      {copied === it.id + "acc" ? <Check className="h-3.5 w-3.5 text-vault" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {it.password_hint && (
                  <div className="flex items-center gap-2 rounded-md bg-surface-elevated px-3 py-2 text-sm">
                    <span className="text-xs text-muted-foreground shrink-0">提示词</span>
                    <span className="flex-1 truncate font-mono text-xs">
                      {isRevealed ? it.password_hint : maskValue(it.password_hint)}
                    </span>
                    <button
                      onClick={() => setReveal((r) => ({ ...r, [it.id]: !r[it.id] }))}
                      className="text-muted-foreground hover:text-vault"
                      title={isRevealed ? "隐藏" : "显示"}
                    >
                      {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                )}

                {it.tags && it.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {it.tags.map((t) => (
                      <span key={t} className="rounded bg-accent/40 px-1.5 py-0.5 text-[10px] text-accent-foreground">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Chip({ children, active, onClick, color }: { children: React.ReactNode; active?: boolean; onClick?: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors " +
        (active
          ? "border-vault/60 bg-vault/10 text-vault"
          : "border-border bg-surface text-muted-foreground hover:text-foreground")
      }
      style={active && color ? { borderColor: color + "80", color, background: color + "18" } : undefined}
    >
      {children}
    </button>
  );
}
