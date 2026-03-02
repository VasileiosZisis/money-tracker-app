import { redirect } from 'next/navigation'
import {
  archiveCategory,
  createCategory,
  listCategories,
  renameCategory,
  unarchiveCategory
} from '@/actions/categories'

type SearchParamsShape = Record<string, string | string[] | undefined>

function firstParamValue (value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

function toQueryParam (input: string) {
  return encodeURIComponent(input)
}

export default async function CategoriesPage ({
  searchParams
}: {
  searchParams?: Promise<SearchParamsShape> | SearchParamsShape
}) {
  const resolvedParams =
    searchParams &&
    typeof (searchParams as Promise<SearchParamsShape>).then === 'function'
      ? await (searchParams as Promise<SearchParamsShape>)
      : (searchParams as SearchParamsShape | undefined) ?? {}

  const errorMessage = firstParamValue(resolvedParams.error)
  const successMessage = firstParamValue(resolvedParams.success)

  async function createCategoryAction (formData: FormData) {
    'use server'

    const result = await createCategory({
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? '') as 'INCOME' | 'EXPENSE'
    })

    if (!result.ok) {
      redirect(`/categories?error=${toQueryParam(result.error)}`)
    }

    redirect('/categories?success=Category%20created.')
  }

  async function renameCategoryAction (formData: FormData) {
    'use server'

    const result = await renameCategory({
      id: String(formData.get('id') ?? ''),
      name: String(formData.get('name') ?? '')
    })

    if (!result.ok) {
      redirect(`/categories?error=${toQueryParam(result.error)}`)
    }

    redirect('/categories?success=Category%20renamed.')
  }

  async function archiveCategoryAction (formData: FormData) {
    'use server'

    const result = await archiveCategory(String(formData.get('id') ?? ''))

    if (!result.ok) {
      redirect(`/categories?error=${toQueryParam(result.error)}`)
    }

    redirect('/categories?success=Category%20archived.')
  }

  async function unarchiveCategoryAction (formData: FormData) {
    'use server'

    const result = await unarchiveCategory(String(formData.get('id') ?? ''))

    if (!result.ok) {
      redirect(`/categories?error=${toQueryParam(result.error)}`)
    }

    redirect('/categories?success=Category%20restored.')
  }

  const categories = await listCategories()

  const incomeCategories = categories.filter(
    category => category.type === 'INCOME'
  )
  const expenseCategories = categories.filter(
    category => category.type === 'EXPENSE'
  )

  const sections = [
    {
      title: 'Income',
      active: incomeCategories.filter(category => !category.isArchived),
      archived: incomeCategories.filter(category => category.isArchived)
    },
    {
      title: 'Expense',
      active: expenseCategories.filter(category => !category.isArchived),
      archived: expenseCategories.filter(category => category.isArchived)
    }
  ]

  return (
    <div className='space-y-6 bg-bg'>
      <section className='rounded-card border border-border bg-surface p-4 sm:p-6'>
        <h1 className='text-page-title text-text'>Categories</h1>
        <p className='mt-2 text-text-2'>
          Manage income and expense categories, including archived ones.
        </p>

        {errorMessage ? (
          <p className='mt-4 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text'>
            {errorMessage}
          </p>
        ) : null}

        {!errorMessage && successMessage ? (
          <p className='mt-4 rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-2'>
            {successMessage}
          </p>
        ) : null}

        <form
          action={createCategoryAction}
          className='mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto]'
        >
          <input
            type='text'
            name='name'
            placeholder='Category name'
            className='rounded-input border border-border bg-bg px-3 py-2 text-text placeholder:text-text-2'
            required
            maxLength={50}
          />
          <select
            name='type'
            defaultValue='EXPENSE'
            className='rounded-input border border-border bg-bg px-3 py-2 text-text'
          >
            <option value='INCOME'>Income</option>
            <option value='EXPENSE'>Expense</option>
          </select>
          <button
            type='submit'
            className='rounded-input bg-primary px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-primary-hover'
          >
            Add category
          </button>
        </form>
      </section>

      {sections.map(section => (
        <section
          key={section.title}
          className='rounded-card border border-border bg-surface p-4 sm:p-6'
        >
          <h2 className='text-section-title text-text'>{section.title}</h2>

          <div className='mt-4 grid gap-4 lg:grid-cols-2'>
            <div className='space-y-3'>
              <h3 className='text-sm font-semibold text-text'>Active</h3>
              {section.active.length === 0 ? (
                <p className='rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-2'>
                  No active {section.title.toLowerCase()} categories.
                </p>
              ) : (
                <ul className='space-y-3'>
                  {section.active.map(category => (
                    <li
                      key={category.id}
                      className='rounded-input border border-border bg-bg p-3'
                    >
                      <div className='flex flex-col gap-3'>
                        <form
                          action={renameCategoryAction}
                          className='flex flex-col gap-2 sm:flex-row'
                        >
                          <input type='hidden' name='id' value={category.id} />
                          <input
                            type='text'
                            name='name'
                            defaultValue={category.name}
                            required
                            maxLength={50}
                            className='w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text'
                          />
                          <button
                            type='submit'
                            className='rounded-input border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-bg'
                          >
                            Rename
                          </button>
                        </form>
                        <form action={archiveCategoryAction}>
                          <input type='hidden' name='id' value={category.id} />
                          <button
                            type='submit'
                            className='rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-2 transition-colors hover:bg-bg hover:text-text'
                          >
                            Archive
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className='space-y-3'>
              <h3 className='text-sm font-semibold text-text'>Archived</h3>
              {section.archived.length === 0 ? (
                <p className='rounded-input border border-border bg-bg px-3 py-2 text-sm text-text-2'>
                  No archived {section.title.toLowerCase()} categories.
                </p>
              ) : (
                <ul className='space-y-3'>
                  {section.archived.map(category => (
                    <li
                      key={category.id}
                      className='rounded-input border border-border bg-bg p-3'
                    >
                      <div className='flex flex-col gap-3'>
                        <form
                          action={renameCategoryAction}
                          className='flex flex-col gap-2 sm:flex-row'
                        >
                          <input type='hidden' name='id' value={category.id} />
                          <input
                            type='text'
                            name='name'
                            defaultValue={category.name}
                            required
                            maxLength={50}
                            className='w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text'
                          />
                          <button
                            type='submit'
                            className='rounded-input border border-border bg-surface px-3 py-2 text-sm text-text transition-colors hover:bg-bg'
                          >
                            Rename
                          </button>
                        </form>
                        <form action={unarchiveCategoryAction}>
                          <input type='hidden' name='id' value={category.id} />
                          <button
                            type='submit'
                            className='rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-2 transition-colors hover:bg-bg hover:text-text'
                          >
                            Unarchive
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      ))}
    </div>
  )
}
