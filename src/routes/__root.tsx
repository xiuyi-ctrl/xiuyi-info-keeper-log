import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogRoot } from "@/components/ConfirmDialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel-elevated max-w-md p-10 text-center">
        <h1 className="text-6xl font-bold text-vault">404</h1>
        <h2 className="mt-4 text-xl font-semibold">页面不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">你访问的保险箱格子似乎并不存在。</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md gradient-accent-bg px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          回到主页
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel-elevated max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold">出了点问题</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error.message || "页面加载失败，请重试。"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md gradient-accent-bg px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            重试
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-surface px-4 py-2 text-sm font-medium"
          >
            回到主页
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "我的信息保险箱 · 个人信息安全记录工具" },
      {
        name: "description",
        content:
          "分类管理账号密码、证件、履历等敏感信息，带修改历程时间轴、脱敏开关、回收站与仪表盘统计。",
      },
      { property: "og:title", content: "我的信息保险箱 · 个人信息安全记录工具" },
      {
        property: "og:description",
        content:
          "分类管理账号密码、证件、履历等敏感信息，带修改历程时间轴、脱敏开关、回收站与仪表盘统计。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "我的信息保险箱 · 个人信息安全记录工具" },
      {
        name: "twitter:description",
        content:
          "分类管理账号密码、证件、履历等敏感信息，带修改历程时间轴、脱敏开关、回收站与仪表盘统计。",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5f8fc7d9-a18e-4b10-a6d7-cc18839b36d6",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/5f8fc7d9-a18e-4b10-a6d7-cc18839b36d6",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap",
      },
      { rel: "icon", href: "/vite.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
      <ConfirmDialogRoot />
    </QueryClientProvider>
  );
}
