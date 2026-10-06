import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { HomepageBrand } from "@/components/homepage/homepage-parts";
import { buttonVariants } from "@/components/ui/button";
import { pageMetadata } from "@/lib/site/metadata";

import styles from "./not-found.module.css";

export const metadata: Metadata = pageMetadata.notFound;

export default function NotFound() {
  return (
    <div className={styles.page}>
      <header className={`${styles.header} home-container`}>
        <HomepageBrand />
      </header>

      <main className={`${styles.main} home-container`}>
        <div className={styles.content}>
          <p className={styles.code}>404</p>
          <h1 className={styles.heading}>Page not found</h1>
          <p className={styles.description}>
            The page you’re looking for doesn’t exist or has moved
          </p>
          <Link href="/" className={`${buttonVariants({ size: "lg" })} ${styles.button}`}>
            <ArrowLeft aria-hidden="true" /> Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
