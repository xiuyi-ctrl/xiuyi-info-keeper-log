import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Shield, Clock, Trash2, BarChart3, KeyRound, Tags } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

const features = [
  {
    icon: KeyRound,
    title: "分类归档",
    desc: "账号密码、入党入团、文件附件——按类型归档，一处管理。",
  },
  {
    icon: Shield,
    title: "脱敏开关",
    desc: "敏感字段默认打码，点眼睛才显示，肩膀上有人也不怕。",
  },
  {
    icon: Clock,
    title: "修改留痕",
    desc: "每次改动自动留存完整快照，可对比历史差异。",
  },
  {
    icon: Trash2,
    title: "回收站 · 7 天",
    desc: "误删可一键还原，超期自动清除。",
  },
  {
    icon: BarChart3,
    title: "仪表盘统计",
    desc: "分类占比、近 7 天活跃趋势一目了然。",
  },
  {
    icon: Tags,
    title: "自定义分类",
    desc: "预置分类可扩展，自定义字段灵活适配你的需求。",
  },
];

function Landing() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg gradient-accent-bg vault-glow">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">我的信息保险箱</span>
        </div>
        <Link
          to="/auth"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-elevated"
        >
          登录 / 注册
        </Link>
      </header>

      <section className="mx-auto max-w-6xl px-6 pt-4 pb-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-vault"></span>
          仅存提示词 · 端到端 RLS 隔离
        </div>
        <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
          把私人信息，锁进你自己的
          <span className="block bg-gradient-to-r from-vault to-chart-2 bg-clip-text text-transparent">
            数字保险箱
          </span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-muted-foreground">
          账号、证件、银行卡、履历、社交账号——分类归档，一处管理。
        </p>
        <div className="mt-4 flex justify-center">
          <Link
            to="/auth"
            className="rounded-lg gradient-accent-bg px-6 py-2.5 font-medium text-primary-foreground vault-glow"
          >
            立即启用
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-6 pb-3">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="panel p-4 transition-transform hover:-translate-y-0.5">
              <f.icon className="h-5 w-5 text-vault" />
              <h3 className="mt-2 text-sm font-semibold">{f.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-3 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} 我的信息保险箱 · 数据加密存储，仅自己可见
      </footer>
    </div>
  );
}
