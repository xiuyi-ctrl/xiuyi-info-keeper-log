import { ExternalLink } from "lucide-react";
import type { ItemAttachment } from "@/lib/vault";

export default function AttachmentPreview({ att, url }: { att: ItemAttachment; url: string }) {
  const mime = att.mime_type ?? "";
  if (mime.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={att.file_name}
        className="max-h-[70vh] w-full rounded-md object-contain"
      />
    );
  }
  if (mime === "application/pdf") {
    return (
      <iframe src={url} title={att.file_name} className="h-[70vh] w-full rounded-md bg-white" />
    );
  }
  if (mime.startsWith("video/")) {
    return <video src={url} controls className="max-h-[70vh] w-full rounded-md" />;
  }
  if (mime.startsWith("audio/")) {
    return <audio src={url} controls className="w-full" />;
  }
  if (mime.startsWith("text/")) {
    return (
      <iframe src={url} title={att.file_name} className="h-[60vh] w-full rounded-md bg-white" />
    );
  }
  return (
    <div className="rounded-md bg-surface-elevated p-8 text-center text-sm text-muted-foreground">
      该文件类型无法直接预览，请下载查看。
    </div>
  );
}

export function AttachmentPreviewLink({ att, url }: { att: ItemAttachment; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-vault hover:underline"
    >
      <ExternalLink className="h-3 w-3" /> 新标签
    </a>
  );
}
