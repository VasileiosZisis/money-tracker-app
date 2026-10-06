import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HomepageMotion } from "@/components/homepage/homepage-motion";
import { pageMetadata } from "@/lib/site/metadata";
import { HomepageBrand, HomepageActions, HomepageScene, HomepageGraph } from "@/components/homepage/homepage-parts";

export const metadata: Metadata = pageMetadata.home;

export default function HomePage() {
  return (
    <div className="homepage" id="homepage">
      <HomepageMotion />
      <a href="#main-content" className="home-skip">Skip to content</a>
      <header className="home-header home-container">
        <HomepageBrand />
        <nav aria-label="Homepage" className="home-nav">
          <a href="#tracking">How it works</a>
          <a href="#insights">Insights</a>
          <Link href="/login" prefetch={false}>Sign in</Link>
        </nav>
      </header>

      <main id="main-content">
        <section className="home-hero" aria-labelledby="hero-heading">
          <div className="home-container home-grid">
            <div className="home-copy">
              <h1 id="hero-heading" className="home-hero-title" data-reveal>
                Your money<br />
                <span>A clearer<br />picture</span>
              </h1>
              <p className="home-body" data-reveal data-delay="80">
                Track what happened. Plan what’s ahead<br className="home-desktop-break" />
                {" "}Understand your money, month by month
              </p>
              <div data-reveal data-delay="160"><HomepageActions /></div>
            </div>
            <HomepageScene kind="hero" />
          </div>
        </section>

        <section id="tracking" className="home-section home-tracking" aria-labelledby="tracking-heading">
          <div className="home-container home-grid">
            <div className="home-copy">
              <h2 id="tracking-heading" className="home-feature-title" data-reveal>
                Make every<br />entry count
              </h2>
              <p className="home-body" data-reveal data-delay="80">
                Record income and expenses, organize your categories, and keep your month in order
              </p>
              <div className="home-details" data-reveal data-delay="140">
                <div><h3>Categories that fit your life</h3><p>Add subcategories when you want a closer look</p></div>
                <div><h3>CSV in, CSV out</h3><p>Bring your records in. Take them with you</p></div>
              </div>
              <Link href="/demo?view=transactions" className="home-explore" data-reveal data-delay="200">
                Explore transactions <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <HomepageScene kind="tracking" />
          </div>
        </section>

        <section id="planning" className="home-section home-planning" aria-labelledby="planning-heading">
          <div className="home-container home-grid">
            <div className="home-copy">
              <h2 id="planning-heading" className="home-feature-title" data-reveal>See what’s<br />still ahead</h2>
              <p className="home-body" data-reveal data-delay="80">
                <strong>Plan monthly bills and expected income.</strong> Mark items paid, received, or skipped when you choose
              </p>
              <p className="home-planning-note" data-reveal data-delay="140">
                Safe to spend is an estimate<br />Pending income stays separate
              </p>
              <Link href="/demo?view=planned" className="home-explore" data-reveal data-delay="200">
                Explore planned items <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <HomepageScene kind="planning" />
          </div>
        </section>

        <section id="insights" className="home-section home-insights" aria-labelledby="insights-heading">
          <div className="home-container home-grid">
            <div className="home-copy">
              <h2 id="insights-heading" className="home-insights-title" data-reveal>
                Find the patterns<br /><span>Keep the perspective</span>
              </h2>
              <p className="home-body" data-reveal data-delay="80">
                Explore monthly cash flow, spending by category, and changes over time
              </p>
              <Link href="/demo?view=insights" className="home-explore" data-reveal data-delay="160">
                Explore Insights <ArrowRight aria-hidden="true" />
              </Link>
            </div>
            <HomepageScene kind="insights" />
          </div>
        </section>

        <section className="home-closing home-container" aria-labelledby="closing-heading">
          <HomepageGraph />
          <h2 id="closing-heading" data-reveal>Your next month starts here</h2>
          <div data-reveal data-delay="80"><HomepageActions /></div>
          <p data-reveal data-delay="140">Manual tracking. Your records, your decisions</p>
        </section>
      </main>

    </div>
  );
}
