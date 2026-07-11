import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Shield, LayoutDashboard, KeyRound, Trash2, LogOut, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppShell,
});

function AppShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("已退出");
    navigate({ to: "/auth", replace: true });
  }

  const nav = [
    { to: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
    { to: "/items", label: "条目", icon: KeyRound },
    { to: "/trash", label: "回收站", icon: Trash2 },
  ] as const;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-accent-bg vault-glow">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-semibold">信息保险箱</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors " +
                    (active
                      ? "bg-surface-elevated text-vault"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface")
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/items/new">
              <Button size="sm" className="gradient-accent-bg text-primary-foreground">
                <Plus className="mr-1 h-4 w-4" /> 新建
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-6 pb-2 md:hidden">
          {nav.map((n) => {
            const active = pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm " +
                  (active ? "bg-surface-elevated text-vault" : "text-muted-foreground")
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
