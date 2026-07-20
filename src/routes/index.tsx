import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Shield, Clock, Eye, Trash2, BarChart3, KeyRound, Flag, FileUp } from "lucide-react";
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
    title: "账号密码",
    desc: "账号、密码提示词、绑定手机与邮箱，一处归档。",
  },
  {
    icon: Flag,
    title: "入党入团",
    desc: "时间、介绍人、编号，入党入团信息随时可查。",
  },
  {
    icon: FileUp,
    title: "文件附件",
    desc: "二维码截图、配置文件、证件照片，支持多文件上传与预览。",
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
    icon: Tag,
    title: "自定义分类",
    desc: "预置分类可扩展，自定义字段灵活适配你的需求。",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg gradient-accent-bg vault-glow">
            <Shield className="h-5 w-5 text-primary-foreground" />
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

      <section className="mx-auto max-w-6xl px-6 pt-10 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-vault"></span>
          仅存提示词 · 端到端 RLS 隔离
        </div>
        <h1 className="mt-6 text-5xl font-bold leading-tight md:text-6xl">
          把私人信息，锁进你自己的
          <span className="block bg-gradient-to-r from-vault to-chart-2 bg-clip-text text-transparent">
            数字保险箱
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          账号、证件、银行卡、履历、社交账号——分类归档，一处管理。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-lg gradient-accent-bg px-6 py-3 font-medium text-primary-foreground vault-glow"
          >
            立即启用
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="panel p-6 transition-transform hover:-translate-y-0.5">
              <f.icon className="h-6 w-6 text-vault" />
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} 我的信息保险箱 · 数据加密存储，仅自己可见
      </footer>
    </div>
  );
}
