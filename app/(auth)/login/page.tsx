export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <section className="w-full max-w-md rounded-card border border-border bg-surface p-6">
        <h1 className="text-title-page text-text-primary">Money Tracker</h1>
        <p className="mt-2 text-body-base text-text-secondary">
          Login placeholder. Google sign-in is added in Task 3.
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-input bg-primary px-4 py-3 text-body-base font-semibold text-surface transition-colors hover:bg-primary-hover"
        >
          Continue with Google
        </button>
      </section>
    </main>
  );
}
