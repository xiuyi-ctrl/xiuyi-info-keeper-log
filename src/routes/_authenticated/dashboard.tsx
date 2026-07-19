import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getCategory, getAllCategories, type Item } from "@/lib/vault";
import { Database, Layers, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: items = [] } = useQuery<Item[]>({
    queryKey: ["items", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("items")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Item[];
    },
  });

  const total = items.length;
  const cats = getAllCategories();
  const byCat = cats
    .map((c) => ({
      name: c.label,
      key: c.key,
      value: items.filter((i) => i.category === c.key).length,
      color: c.color,
    }))
    .filter((c) => c.value > 0);

  // Last 7 days series
  const days: { day: string; 新增: number; 修改: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const label = `${d.getMonth() + 1}/${d.getDate()}`;
    const created = items.filter((i) => {
      const t = new Date(i.created_at).getTime();
      return t >= d.getTime() && t < next.getTime();
    }).length;
    const updated = items.filter((i) => {
      const t = new Date(i.updated_at).getTime();
      return t >= d.getTime() && t < next.getTime() && i.updated_at !== i.created_at;
    }).length;
    days.push({ day: label, 新增: created, 修改: updated });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">仪表盘</h1>
        <p className="mt-1 text-muted-foreground">你的信息保险箱一览</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={Database} label="总条目数" value={total} accent="text-vault" />
        <StatCard icon={Layers} label="使用分类数" value={byCat.length} accent="text-chart-2" />
        <StatCard
          icon={Sparkles}
          label="近 7 天新增"
          value={days.reduce((s, d) => s + d["新增"], 0)}
          accent="text-chart-3"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-6">
          <h3 className="mb-4 text-lg font-semibold">分类分布</h3>
          {byCat.length === 0 ? (
            <EmptyChart label="暂无数据，去" cta="新建第一条记录" to="/items/new" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byCat}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={2}
                  >
                    {byCat.map((c, i) => (
                      <Cell key={i} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-elevated)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "#ffffff",
                    }}
                    itemStyle={{ color: "#ffffff" }}
                    labelStyle={{ color: "#ffffff" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {byCat.map((c) => (
              <div
                key={c.key}
                className="flex items-center gap-1.5 rounded-md bg-surface-elevated px-2 py-1 text-xs"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name} · {c.value}
              </div>
            ))}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="mb-4 text-lg font-semibold">近 7 天活跃度</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={days}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "#ffffff",
                  }}
                  itemStyle={{ color: "#ffffff" }}
                  labelStyle={{ color: "#ffffff" }}
                />

                <Line
                  type="monotone"
                  dataKey="新增"
                  stroke="var(--vault)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="修改"
                  stroke="oklch(0.68 0.18 265)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">最近条目</h3>
          <Link to="/items" className="text-sm text-vault hover:underline">
            查看全部 →
          </Link>
        </div>
        {items.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            还没有任何记录，
            <Link to="/items/new" className="text-vault">
              立即新建
            </Link>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {items.slice(0, 6).map((it) => {
              const c = getCategory(it.category);
              return (
                <Link
                  key={it.id}
                  to="/items/$id"
                  params={{ id: it.id }}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-surface-elevated/40 p-3 hover:bg-surface-elevated"
                >
                  <div
                    className="grid h-9 w-9 place-items-center rounded-md"
                    style={{ background: `${c.color}22`, color: c.color }}
                  >
                    <c.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{it.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.label}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className={`h-5 w-5 ${accent}`} />
      </div>
      <div className="mt-3 font-display text-4xl font-bold">{value}</div>
    </div>
  );
}

function EmptyChart({ label, cta, to }: { label: string; cta: string; to: string }) {
  return (
    <div className="flex h-64 flex-col items-center justify-center text-sm text-muted-foreground">
      {label}
      <Link to={to} className="mt-2 text-vault hover:underline">
        {cta} →
      </Link>
    </div>
  );
}
