import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

import graphStyles from "./homepage-graph.module.css";

export function HomepageBrand() {
  return (
    <Link href="/" aria-label="CashContour home" className="home-brand">
      <Image src="/branding/cashcontour-symbol-dark.svg" alt="" width={1502} height={920} unoptimized className="home-brand-symbol" />
      <Image src="/branding/cashcontour-wordmark-dark.svg" alt="" width={1973} height={249} unoptimized className="home-brand-wordmark" />
    </Link>
  );
}

export function HomepageActions() {
  return (
    <div className="home-actions">
      <Link href="/login" prefetch={false} className={`${buttonVariants({ size: "lg" })} home-button home-button-primary`}>
        Get started <ArrowRight aria-hidden="true" />
      </Link>
      <Link href="/demo" className={`${buttonVariants({ size: "lg", variant: "outline" })} home-button home-button-outline`}>
        Try demo
      </Link>
    </div>
  );
}

export function HomepageGraph() {
  return (
    <figure className={`home-closing-graph ${graphStyles.graph}`} data-reveal>
      <figcaption className={graphStyles.heading}>
        <strong>Monthly income and expenses</strong>
      </figcaption>
      <Image
        src="/homepage/monthly-result-graph.svg"
        alt="CashContour demo graph from March through September 2026, showing income and expenses. September is incomplete"
        width={927}
        height={216}
        className={`home-graph-image ${graphStyles.image}`}
        unoptimized
      />
      <div className={graphStyles.legend}>
        <span className={graphStyles.income}>Income</span>
        <span className={graphStyles.expenses}>Expenses</span>
        <span className={graphStyles.note}>September is incomplete</span>
      </div>
    </figure>
  );
}

const scenes = {
  hero: { title: "September", rows: [["Salary", "€2,800.00"], ["Rent", "€900.00"]] },
  tracking: { title: "Transactions", rows: [["Salary", "€2,800.00"], ["Rent", "€900.00"], ["Groceries", "€135.25"]] },
  planning: { title: "Planned items", rows: [["Electricity", "€85.00"], ["Internet", "€35.00"], ["Freelance project", "€450.00"]] },
  insights: { title: "Insights", rows: [["Monthly cash flow"], ["Spending by category"], ["Changes over time"]] },
} as const;

export function HomepageScene({ kind }: { kind: keyof typeof scenes }) {
  const { title, rows } = scenes[kind];

  return (
    <div className={`home-scene home-scene-${kind}`}>
      <div className="home-art" data-reveal data-delay="100">
        <div data-parallax="1">
          <Image
            src={`/homepage/${kind}-still-life.png`}
            alt=""
            width={1280}
            height={1280}
            sizes="(max-width: 767px) 100vw, (max-width: 1599px) 52vw, 800px"
            preload={kind === "hero"}
          />
        </div>
      </div>
      <div className="home-preview-position" data-reveal data-delay="200">
        <div data-parallax="-0.7">
          <div className="home-preview" role="group" aria-label={`${title} preview — fictional sample data in EUR`}>
            <div className="home-preview-header"><h3>{title}</h3></div>
            {kind === "insights" ? (
              <ul className="home-preview-insights">
                {rows.map(([label]) => (
                  <li key={label}><Link href="/demo?view=insights">{label}<ChevronRight aria-hidden="true" /></Link></li>
                ))}
              </ul>
            ) : (
              <dl className="home-preview-rows">
                {rows.map(([label, amount]) => (
                  <div key={label}><dt>{label}</dt><dd>{amount}</dd></div>
                ))}
              </dl>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
