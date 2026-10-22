import katex from "katex";
import { useMemo } from "react";

function renderChunk(text: string, display: boolean): string {
  try {
    return katex.renderToString(text, { displayMode: display, throwOnError: false });
  } catch {
    return text;
  }
}

export function MathText({ text }: { text: string }) {
  const html = useMemo(() => {
    const pattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;
    let last = 0;
    let out = "";
    const source = text ?? "";
    for (const match of source.matchAll(pattern)) {
      const index = match.index ?? 0;
      out += escapeHtml(source.slice(last, index)).replaceAll("\n", "<br />");
      if (match[1] || match[4]) out += renderChunk(match[1] ?? match[4], true);
      else out += renderChunk(match[2] ?? match[3], false);
      last = index + match[0].length;
    }
    out += escapeHtml(source.slice(last)).replaceAll("\n", "<br />");
    return out;
  }, [text]);

  return <span className="math-text" dangerouslySetInnerHTML={{ __html: html }} />;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function pickText(
  value: { en?: string | null; hi?: string | null } | string | null | undefined,
  lang: "en" | "hi",
): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (value[lang] || value.en || value.hi || "").toString();
}
