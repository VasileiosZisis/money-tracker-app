/**
 * Forecast helpers in this phase are computed on demand from actual transactions,
 * active planned bills, and month/date utilities. Forecast snapshots are not
 * persisted to the database.
 */

export type ForecastComputationMode = "on-demand";

export {
  buildForecastMonthContext,
  getTodayLocalDate,
  type ForecastMonthContext,
  type ForecastMonthRelation,
} from "@/lib/forecast/month-context";
export {
  calculateExpenseSoFar,
  calculateIncomeSoFar,
  calculateNetLeftNow,
  filterTransactionsSoFar,
} from "@/lib/forecast/actuals";
export {
  calculateUnpaidPlannedBills,
  getPlannedExpenseCategoryIds,
} from "@/lib/forecast/planned-bills";
export {
  calculatePendingPlannedIncome,
  type ForecastPlannedIncomeLike,
} from "@/lib/forecast/planned-income";
export {
  calculateVariableCategoryForecast,
  type VariableCategoryForecastResult,
  type VariableForecastSource,
} from "@/lib/forecast/variable-forecast";
export {
  calculateForecastRemainingSpend,
  calculateProjectedEndOfMonthNet,
  calculateSafeToSpend,
  computeForecastSummary,
  type ForecastInputPlannedBill,
  type ForecastInputPlannedIncome,
  type ForecastInputTransaction,
  type ForecastSummary,
} from "@/lib/forecast/compute-forecast";
