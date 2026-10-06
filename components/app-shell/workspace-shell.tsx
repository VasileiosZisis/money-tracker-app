import type { ReactNode } from "react";

import { SidebarProvider } from "@/components/ui/sidebar";

/** Presentation only; each caller supplies its own navigation and date context. */
export function WorkspaceShell({ sidebar, contextBar, children }: {
  sidebar: ReactNode;
  contextBar: ReactNode;
  children: ReactNode;
}) {
  return <div className="min-h-screen"><SidebarProvider>
    <div className="mx-auto flex min-h-screen gap-3 px-3 pb-3 transition-[padding,column-gap] duration-250 ease-in-out motion-reduce:transition-none sm:px-5 lg:gap-0 lg:py-0 lg:pr-5 lg:pl-5 lg:group-data-[sidebar-open=true]/sidebar-provider:gap-5 lg:group-data-[sidebar-open=true]/sidebar-provider:pl-0">
      {sidebar}
      <main className="flex min-w-0 flex-1 flex-col gap-3 pb-5 lg:gap-5">
        {contextBar}
        <div className="mx-auto flex w-full flex-col gap-5">{children}</div>
      </main>
    </div>
  </SidebarProvider></div>;
}
