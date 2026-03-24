/**
 * Forecast helpers in this phase are computed on demand from actual transactions,
 * active planned bills, and month/date utilities. Forecast snapshots are not
 * persisted to the database.
 */

export type ForecastComputationMode = "on-demand";
