import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type PendingState = { opts: ConfirmOptions; resolve: (v: boolean) => void };

let externalTrigger: ((o: ConfirmOptions) => Promise<boolean>) | null = null;

export function confirmDialog(opts: ConfirmOptions): Promise<boolean> {
  if (externalTrigger) return externalTrigger(opts);
  if (typeof window !== "undefined") return Promise.resolve(window.confirm(opts.description ?? opts.title ?? ""));
  return Promise.resolve(false);
}

export function ConfirmDialogRoot() {
  const [pending, setPending] = useState<PendingState | null>(null);

  useEffect(() => {
    externalTrigger = (opts) =>
      new Promise<boolean>((resolve) => setPending({ opts, resolve }));
    return () => {
      externalTrigger = null;
    };
  }, []);

  function close(result: boolean) {
    if (!pending) return;
    pending.resolve(result);
    setPending(null);
  }

  const o = pending?.opts;
  const destructive = !!o?.destructive;

  return (
    <Dialog open={!!pending} onOpenChange={(v) => !v && close(false)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {o?.title ?? "请确认操作"}
          </DialogTitle>
          {o?.description && (
            <DialogDescription className="whitespace-pre-wrap pt-1 text-sm">
              {o.description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {o?.cancelText ?? "取消"}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => close(true)}
            className={destructive ? "" : "gradient-accent-bg text-primary-foreground"}
          >
            {o?.confirmText ?? "确认"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
