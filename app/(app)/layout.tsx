import Link from "next/link";
import SignOutButton from "@/components/auth/SignOutButton";

const navItems = [
  { href: "/setup", label: "Setup" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/categories", label: "Categories" },
  { href: "/export", label: "Export" },
];

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dashboard" className="text-title-section text-text-primary">
            Money Tracker
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm font-medium">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-input px-3 py-2 text-text-secondary transition-colors hover:bg-background hover:text-primary"
              >
                {item.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl p-4">{children}</main>
    </div>
  );
}
