export function mimeToLabel(mime: string | null): string {
  const m = mime ?? "";
  if (m.startsWith("image/")) return "IMG";
  if (m === "application/pdf") return "PDF";
  if (m.startsWith("video/")) return "VID";
  if (m.startsWith("audio/")) return "AUD";
  if (m.includes("word")) return "DOC";
  if (m.includes("sheet") || m.includes("excel")) return "XLS";
  if (m.includes("zip") || m.includes("compressed")) return "ZIP";
  return "FILE";
}

export default function FileTypeIcon({ mime }: { mime: string | null }) {
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-vault/10 text-[10px] font-mono text-vault">
      {mimeToLabel(mime)}
    </span>
  );
}
