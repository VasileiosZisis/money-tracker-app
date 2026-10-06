import type { ReactNode } from "react";

export function EditorActions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-end gap-3 border-t border-border/70 pt-5">{children}</div>;
}
