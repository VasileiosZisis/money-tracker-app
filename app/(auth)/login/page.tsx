import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { GoogleSignInButton } from "../_components/google-sign-in-button";
import { getSession } from "@/lib/auth/session";
import { HomepageBrand } from "@/components/homepage/homepage-parts";
import { buttonVariants } from "@/components/ui/button";
import { db } from "@/lib/db";

import styles from "./login-header.module.css";

export const metadata: Metadata = {
  title: "Sign in — CashContour",
  description: "Sign in to your personal money workspace",
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getSession();
  const { error } = await searchParams;

  if (session?.user?.id) {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        hasCompletedSetup: true,
        timeZone: true,
      },
    });

    if (user?.hasCompletedSetup && user.timeZone) {
      redirect("/dashboard");
    }

    if (user && (!user.hasCompletedSetup || !user.timeZone)) {
      redirect("/setup");
    }
  }

  return (
    <div className="login-page">
      <header className={`${styles.header} login-header login-container`}>
        <HomepageBrand />
        <Link href="/" className={`${styles.back} login-back`}>
          <ArrowLeft aria-hidden="true" /> Back to home
        </Link>
      </header>

      <main className="login-main login-container">
        <div className="login-editorial">
          <p className="login-headline login-enter">
            Your money<br />
            <span>A clearer picture</span>
          </p>
          <Image
            src="/homepage/hero-still-life.png"
            alt=""
            width={1280}
            height={1280}
            sizes="(max-width: 1023px) 1px, (max-width: 1599px) 43vw, 640px"
            className="login-artwork login-enter"
          />
        </div>

        <section className="login-signin login-enter" aria-labelledby="login-heading">
          <h1 id="login-heading">Welcome to<br />CashContour</h1>
          <p className="login-description">Sign in to your personal money workspace</p>
          <div className="login-controls">
            {error ? (
              <div role="alert" className="login-error">
                <p>Google sign-in could not complete</p>
                <p>Please try again</p>
              </div>
            ) : null}
            <GoogleSignInButton />
            <Link href="/demo" className={`${buttonVariants({ variant: "outline" })} login-demo-button`}>
              Try demo
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
