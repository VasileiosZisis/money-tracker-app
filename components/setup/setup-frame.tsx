import type { ReactNode } from "react";
import { HomepageBrand } from "@/components/homepage/homepage-parts";

export function SetupFrame({ children }: { children: ReactNode }) {
  return (
    <div className="setup-page">
      <header className="setup-header setup-container">
        <HomepageBrand />
      </header>
      <main className="setup-main setup-container">{children}</main>
    </div>
  );
}
