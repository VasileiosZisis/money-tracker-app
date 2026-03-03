function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export default function ExportPage() {
  const defaultMonth = getCurrentMonth();

  return (
    <div className="space-y-6 bg-bg text-text">
      <header className="space-y-2">
        <h1 className="text-page-title">Export</h1>
        <p className="text-body text-text-2">
          Download your monthly transactions as CSV.
        </p>
      </header>

      <section className="max-w-xl rounded-card border border-border bg-surface p-4">
        <h2 className="text-section-title">CSV export</h2>

        <form action="/export/download" method="get" className="mt-4 space-y-3">
          <label className="block space-y-1">
            <span className="text-meta text-text-2">Month</span>
            <input
              type="month"
              name="month"
              defaultValue={defaultMonth}
              className="w-full rounded-input border border-border bg-bg px-3 py-2 text-text"
            />
          </label>

          <button
            type="submit"
            className="rounded-input bg-primary px-4 py-2 text-body text-bg hover:bg-primary-hover"
          >
            Download CSV
          </button>
        </form>
      </section>
    </div>
  );
}
