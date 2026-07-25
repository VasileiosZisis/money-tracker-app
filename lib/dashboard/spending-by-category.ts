import { Prisma } from "@/generated/prisma/client";

export type DashboardSpendingCategory = {
  categoryId: string;
  categoryName: string;
  total: number;
  subcategories: Array<{
    subcategoryId: string | null;
    subcategoryName: string;
    total: number;
  }>;
};

export type SpendingBreakdownTransaction = {
  type: "INCOME" | "EXPENSE";
  amount: Prisma.Decimal;
  categoryId: string;
  subcategoryId: string | null;
  category: {
    name: string;
  };
  subcategory: {
    name: string;
  } | null;
};

type SubcategoryBucket = {
  subcategoryId: string | null;
  subcategoryName: string;
  total: Prisma.Decimal;
};

type CategoryBucket = {
  categoryId: string;
  categoryName: string;
  total: Prisma.Decimal;
  subcategories: Map<string, SubcategoryBucket>;
};

const NO_SUBCATEGORY_KEY = "__no_subcategory__";
const NO_SUBCATEGORY_LABEL = "No subcategory";

function compareAmountsThenNames(
  left: { total: Prisma.Decimal; name: string },
  right: { total: Prisma.Decimal; name: string },
) {
  const amountComparison = right.total.comparedTo(left.total);

  return amountComparison === 0
    ? left.name.localeCompare(right.name)
    : amountComparison;
}

export function buildSpendingByCategory(
  transactions: SpendingBreakdownTransaction[],
): DashboardSpendingCategory[] {
  const categories = new Map<string, CategoryBucket>();

  for (const transaction of transactions) {
    if (transaction.type !== "EXPENSE") {
      continue;
    }

    let category = categories.get(transaction.categoryId);

    if (!category) {
      category = {
        categoryId: transaction.categoryId,
        categoryName: transaction.category.name,
        total: new Prisma.Decimal(0),
        subcategories: new Map(),
      };
      categories.set(transaction.categoryId, category);
    }

    category.total = category.total.plus(transaction.amount);

    const subcategoryKey =
      transaction.subcategoryId ?? NO_SUBCATEGORY_KEY;
    let subcategory = category.subcategories.get(subcategoryKey);

    if (!subcategory) {
      subcategory = {
        subcategoryId: transaction.subcategoryId,
        subcategoryName:
          transaction.subcategory?.name ?? NO_SUBCATEGORY_LABEL,
        total: new Prisma.Decimal(0),
      };
      category.subcategories.set(subcategoryKey, subcategory);
    }

    subcategory.total = subcategory.total.plus(transaction.amount);
  }

  return Array.from(categories.values())
    .sort((left, right) =>
      compareAmountsThenNames(
        { total: left.total, name: left.categoryName },
        { total: right.total, name: right.categoryName },
      ),
    )
    .map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      total: Number(category.total.toString()),
      subcategories: Array.from(category.subcategories.values())
        .sort((left, right) =>
          compareAmountsThenNames(
            { total: left.total, name: left.subcategoryName },
            { total: right.total, name: right.subcategoryName },
          ),
        )
        .map((subcategory) => ({
          subcategoryId: subcategory.subcategoryId,
          subcategoryName: subcategory.subcategoryName,
          total: Number(subcategory.total.toString()),
        })),
    }));
}
