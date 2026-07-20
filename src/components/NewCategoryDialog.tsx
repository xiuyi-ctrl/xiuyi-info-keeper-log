import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { addCustomCategory, MAX_CUSTOM_FIELDS, type FieldType } from "@/lib/vault";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export function NewCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (key: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [fields, setFields] = useState<{ key: string; label: string; type: FieldType }[]>([]);

  function addField() {
    if (fields.length >= MAX_CUSTOM_FIELDS)
      return toast.error(`最多 ${MAX_CUSTOM_FIELDS} 个自定义字段`);
    setFields((s) => [
      ...s,
      { key: `f_${Date.now().toString(36)}_${s.length}`, label: "", type: "text" },
    ]);
  }

  function save() {
    if (!label.trim()) return toast.error("请输入分类名");
    const cleaned = fields.filter((f) => f.label.trim());
    try {
      const key = addCustomCategory(label.trim(), cleaned);
      setLabel("");
      setFields([]);
      onCreated(key);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增自定义分类</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>分类名称</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例：车辆信息 / 保险单"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                自定义字段{" "}
                <span className="text-xs text-muted-foreground">
                  最多 {MAX_CUSTOM_FIELDS} 个，备注字段自动包含
                </span>
              </Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="mr-1 h-3 w-3" /> 添加字段
              </Button>
            </div>
            {fields.map((f, i) => (
              <div
                key={f.key}
                className="flex items-center gap-2 rounded-md bg-surface-elevated p-2"
              >
                <Input
                  placeholder={`字段名 ${i + 1}`}
                  value={f.label}
                  onChange={(e) =>
                    setFields((s) =>
                      s.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                    )
                  }
                  className="h-8 flex-1"
                />
                <select
                  value={f.type}
                  onChange={(e) =>
                    setFields((s) =>
                      s.map((x, j) => (j === i ? { ...x, type: e.target.value as FieldType } : x)),
                    )
                  }
                  className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
                >
                  <option value="text">文本</option>
                  <option value="textarea">多行</option>
                  <option value="date">日期</option>
                  <option value="password">密码</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFields((s) => s.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <div className="rounded-md border border-dashed border-border/60 bg-surface-elevated/40 px-3 py-2 text-xs text-muted-foreground">
              备注（自动）
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={save} className="gradient-accent-bg text-primary-foreground">
            保存分类
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
