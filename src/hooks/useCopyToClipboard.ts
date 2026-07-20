import { useState, useCallback } from "react";
import { toast } from "sonner";

export function useCopyToClipboard(resetMs = 1500) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = useCallback(
    async (id: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopied(id);
        toast.success("已复制到剪贴板");
        setTimeout(() => setCopied(null), resetMs);
      } catch {
        toast.error("复制失败");
      }
    },
    [resetMs],
  );

  return { copied, copy } as const;
}
