import type { ReactNode } from "react";

export function WorkspaceCardGroup({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <p
        id={id}
        className="mb-3 flex items-center gap-3 text-lg font-semibold tracking-tight text-foreground after:h-px after:flex-1 after:bg-border"
      >
        {title}
      </p>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}
