import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import AttachmentPreview, { AttachmentPreviewLink } from "@/components/AttachmentPreview";
import { downloadAttachment } from "@/lib/attachments";
import { Download } from "lucide-react";
import type { ItemAttachment } from "@/lib/vault";

type PreviewAtt = { att: ItemAttachment; url: string } | null;

export function AttachmentPreviewDialog({
  previewAtt,
  setPreviewAtt,
}: {
  previewAtt: PreviewAtt;
  setPreviewAtt: (v: PreviewAtt) => void;
}) {
  return (
    <Dialog open={!!previewAtt} onOpenChange={(o) => !o && setPreviewAtt(null)}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8">
            <span className="truncate">{previewAtt?.att.file_name}</span>
            {previewAtt && <AttachmentPreviewLink att={previewAtt.att} url={previewAtt.url} />}
          </DialogTitle>
        </DialogHeader>
        {previewAtt && <AttachmentPreview att={previewAtt.att} url={previewAtt.url} />}
        <DialogFooter>
          {previewAtt && (
            <Button variant="outline" onClick={() => downloadAttachment(previewAtt.att)}>
              <Download className="mr-1 h-4 w-4" /> 下载
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
