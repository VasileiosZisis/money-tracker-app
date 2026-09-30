type TransactionType = "INCOME" | "EXPENSE";

type FormCategory = {
  id: string;
  type: TransactionType;
  subcategories: { id: string; name: string }[];
};

export function getTransactionFormSelection<T extends FormCategory>(
  categories: T[],
  type: TransactionType,
  categoryId: string,
  subcategoryId: string,
) {
  const availableCategories = categories.filter((category) => category.type === type);
  const selectedCategory = availableCategories.find((category) => category.id === categoryId);
  const availableSubcategories = selectedCategory?.subcategories ?? [];

  return {
    availableCategories,
    categoryId: selectedCategory?.id ?? "",
    availableSubcategories,
    subcategoryId: availableSubcategories.some((subcategory) => subcategory.id === subcategoryId)
      ? subcategoryId
      : "",
  };
}
