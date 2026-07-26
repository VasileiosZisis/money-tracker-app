import { FolderKanban, FolderOpen, ListTree, Plus, Trash2 } from 'lucide-react'
import { redirect } from 'next/navigation'

import {
  archiveCategory,
  createCategory,
  createSubcategory,
  deleteSubcategory,
  listCategories,
  renameCategory,
  renameSubcategory,
  unarchiveCategory
} from '@/actions/categories'
import { PageHeader } from '@/components/app-shell/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageNotice } from '@/components/ui/page-notice'
import { Select } from '@/components/ui/select'
import {
  buildPathWithSearchParams,
  firstSearchParamValue,
  resolveSearchParams,
  type PageSearchParams
} from '@/lib/routes/search-params'

type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number]

function CategorySubcategoriesSection ({
  category,
  createSubcategoryAction,
  renameSubcategoryAction,
  deleteSubcategoryAction
}: {
  category: CategoryRow
  createSubcategoryAction: (formData: FormData) => Promise<void>
  renameSubcategoryAction: (formData: FormData) => Promise<void>
  deleteSubcategoryAction: (formData: FormData) => Promise<void>
}) {
  return (
    <div className='rounded-xl border border-border/80 bg-card/70 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <ListTree className='size-4 text-muted-foreground' />
          <h4 className='text-sm font-semibold text-foreground'>
            Subcategories
          </h4>
        </div>
        <Badge variant='outline' className='rounded-full'>
          {category.subcategories.length}{' '}
          {category.subcategories.length === 1
            ? 'subcategory'
            : 'subcategories'}
        </Badge>
      </div>

      <div className='mt-4 space-y-3'>
        {category.subcategories.length === 0 ? (
          <p className='text-sm leading-6 text-muted-foreground'>
            No subcategories yet. Add optional subcategories for more precise
            transaction labels in this category.
          </p>
        ) : (
          category.subcategories.map(subcategory => (
            <div
              key={subcategory.id}
              className='rounded-[20px] border border-border/70 bg-background/70 p-3'
            >
              <div className='flex flex-col gap-3'>
                <form
                  action={renameSubcategoryAction}
                  className='flex flex-col gap-3 sm:flex-row'
                >
                  <input type='hidden' name='id' value={subcategory.id} />
                  <Input
                    type='text'
                    name='name'
                    defaultValue={subcategory.name}
                    required
                    maxLength={50}
                    className='flex-1'
                  />
                  <Button type='submit' variant='outline'>
                    Rename
                  </Button>
                </form>

                <form action={deleteSubcategoryAction}>
                  <input type='hidden' name='id' value={subcategory.id} />
                  <Button
                    type='submit'
                    variant='outline'
                    className='w-full sm:w-auto'
                  >
                    <Trash2 />
                    Delete subcategory
                  </Button>
                </form>
              </div>
            </div>
          ))
        )}

        <form
          action={createSubcategoryAction}
          className='grid gap-3 rounded-[20px] border border-dashed border-border/80 bg-background/50 p-3 sm:grid-cols-[minmax(0,1fr)_auto]'
        >
          <input type='hidden' name='categoryId' value={category.id} />
          <Input
            type='text'
            name='name'
            placeholder='Add subcategory'
            required
            maxLength={50}
          />
          <Button type='submit' variant='outline'>
            <Plus />
            Add subcategory
          </Button>
        </form>
      </div>
    </div>
  )
}

export default async function CategoriesPage ({
  searchParams
}: {
  searchParams?: PageSearchParams
}) {
  const resolvedParams = await resolveSearchParams(searchParams)

  const errorMessage = firstSearchParamValue(resolvedParams.error)
  const successMessage = firstSearchParamValue(resolvedParams.success)

  async function createCategoryAction (formData: FormData) {
    'use server'

    const result = await createCategory({
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? '') as 'INCOME' | 'EXPENSE'
    })

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', { success: 'Category created.' })
    )
  }

  async function renameCategoryAction (formData: FormData) {
    'use server'

    const result = await renameCategory({
      id: String(formData.get('id') ?? ''),
      name: String(formData.get('name') ?? '')
    })

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', { success: 'Category renamed.' })
    )
  }

  async function archiveCategoryAction (formData: FormData) {
    'use server'

    const result = await archiveCategory(String(formData.get('id') ?? ''))

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', {
        success: 'Category archived.'
      })
    )
  }

  async function unarchiveCategoryAction (formData: FormData) {
    'use server'

    const result = await unarchiveCategory(String(formData.get('id') ?? ''))

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', {
        success: 'Category restored.'
      })
    )
  }

  async function createSubcategoryAction (formData: FormData) {
    'use server'

    const result = await createSubcategory({
      categoryId: String(formData.get('categoryId') ?? ''),
      name: String(formData.get('name') ?? '')
    })

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', {
        success: 'Subcategory created.'
      })
    )
  }

  async function renameSubcategoryAction (formData: FormData) {
    'use server'

    const result = await renameSubcategory({
      id: String(formData.get('id') ?? ''),
      name: String(formData.get('name') ?? '')
    })

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', {
        success: 'Subcategory renamed.'
      })
    )
  }

  async function deleteSubcategoryAction (formData: FormData) {
    'use server'

    const result = await deleteSubcategory(String(formData.get('id') ?? ''))

    if (!result.ok) {
      redirect(
        buildPathWithSearchParams('/categories', { error: result.error })
      )
    }

    redirect(
      buildPathWithSearchParams('/categories', {
        success: 'Subcategory deleted.'
      })
    )
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
      description: 'Categories for money coming in.',
      active: incomeCategories.filter(category => !category.isArchived),
      archived: incomeCategories.filter(category => category.isArchived)
    },
    {
      title: 'Expense',
      description: 'Categories for money going out.',
      active: expenseCategories.filter(category => !category.isArchived),
      archived: expenseCategories.filter(category => category.isArchived)
    }
  ]

  return (
    <div className='flex flex-col gap-5'>
      <PageHeader
        eyebrow='Structure'
        title='Categories'
        description='Keep income and expense labels tidy, rename them when your tracking style changes, and archive anything you no longer need in the default picker.'
      />

      <section className='grid gap-4 md:grid-cols-3'>
        <Card>
          <CardContent className='flex flex-col gap-1 p-4'>
            <p className='text-sm font-medium text-muted-foreground'>
              Total categories
            </p>
            <p className='text-xl font-semibold tracking-tight text-foreground'>
              {categories.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex flex-col gap-1 p-4'>
            <p className='text-sm font-medium text-muted-foreground'>Active</p>
            <p className='text-xl font-semibold tracking-tight text-foreground'>
              {categories.filter(category => !category.isArchived).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='flex flex-col gap-1 p-4'>
            <p className='text-sm font-medium text-muted-foreground'>
              Total subcategories
            </p>
            <p className='text-xl font-semibold tracking-tight text-foreground'>
              {categories.reduce(
                (sum, category) => sum + category.subcategories.length,
                0
              )}
            </p>
          </CardContent>
        </Card>
      </section>

      {errorMessage ? (
        <PageNotice variant='error' title='Something needs attention'>
          {errorMessage}
        </PageNotice>
      ) : null}

      {!errorMessage && successMessage ? (
        <PageNotice variant='success' title='Saved'>
          {successMessage}
        </PageNotice>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Add category</CardTitle>
          <CardDescription>
            New categories become available for transactions immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createCategoryAction}
            className='grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]'
          >
            <Input
              type='text'
              name='name'
              placeholder='Category name'
              required
              maxLength={50}
            />
            <Select name='type' defaultValue='EXPENSE'>
              <option value='INCOME'>Income</option>
              <option value='EXPENSE'>Expense</option>
            </Select>
            <Button type='submit'>
              <Plus />
              Add category
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className='grid gap-4 xl:grid-cols-2'>
        {sections.map(section => (
          <Card key={section.title} className='overflow-hidden'>
            <CardHeader className='border-b border-border/70 pb-4'>
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='space-y-1.5'>
                  <CardTitle>{section.title}</CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </div>
                <div className='flex gap-2'>
                  <Badge variant='outline'>
                    {section.active.length} active
                  </Badge>
                  <Badge variant='outline'>
                    {section.archived.length} archived
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className='grid gap-4 p-4'>
              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <FolderKanban className='size-4.5 text-muted-foreground' />
                  <h3 className='text-sm font-semibold text-foreground'>
                    Active
                  </h3>
                </div>

                {section.active.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title={`No active ${section.title.toLowerCase()} categories`}
                    description='Create one above or restore an archived category.'
                  />
                ) : (
                  <div className='space-y-3'>
                    {section.active.map(category => (
                      <div
                        key={category.id}
                        className='rounded-xl border border-border/80 bg-background/60 p-4'
                      >
                        <div className='flex flex-col gap-3'>
                          <form
                            action={renameCategoryAction}
                            className='flex flex-col gap-3 sm:flex-row'
                          >
                            <input
                              type='hidden'
                              name='id'
                              value={category.id}
                            />
                            <Input
                              type='text'
                              name='name'
                              defaultValue={category.name}
                              required
                              maxLength={50}
                              className='flex-1'
                            />
                            <Button type='submit' variant='outline'>
                              Rename
                            </Button>
                          </form>
                          <form action={archiveCategoryAction}>
                            <input
                              type='hidden'
                              name='id'
                              value={category.id}
                            />
                            <Button
                              type='submit'
                              variant='outline'
                              className='w-full sm:w-auto'
                            >
                              Archive
                            </Button>
                          </form>
                          <CategorySubcategoriesSection
                            category={category}
                            createSubcategoryAction={createSubcategoryAction}
                            renameSubcategoryAction={renameSubcategoryAction}
                            deleteSubcategoryAction={deleteSubcategoryAction}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className='space-y-3'>
                <div className='flex items-center gap-2'>
                  <FolderOpen className='size-4.5 text-muted-foreground' />
                  <h3 className='text-sm font-semibold text-foreground'>
                    Archived
                  </h3>
                </div>

                {section.archived.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title={`No archived ${section.title.toLowerCase()} categories`}
                    description='Archived categories will stay connected to existing transactions and can be restored here.'
                  />
                ) : (
                  <div className='space-y-3'>
                    {section.archived.map(category => (
                      <div
                        key={category.id}
                        className='rounded-xl border border-border/80 bg-background/60 p-4'
                      >
                        <div className='flex flex-col gap-3'>
                          <form
                            action={renameCategoryAction}
                            className='flex flex-col gap-3 sm:flex-row'
                          >
                            <input
                              type='hidden'
                              name='id'
                              value={category.id}
                            />
                            <Input
                              type='text'
                              name='name'
                              defaultValue={category.name}
                              required
                              maxLength={50}
                              className='flex-1'
                            />
                            <Button type='submit' variant='outline'>
                              Rename
                            </Button>
                          </form>
                          <form action={unarchiveCategoryAction}>
                            <input
                              type='hidden'
                              name='id'
                              value={category.id}
                            />
                            <Button
                              type='submit'
                              variant='outline'
                              className='w-full sm:w-auto'
                            >
                              Restore
                            </Button>
                          </form>
                          <CategorySubcategoriesSection
                            category={category}
                            createSubcategoryAction={createSubcategoryAction}
                            renameSubcategoryAction={renameSubcategoryAction}
                            deleteSubcategoryAction={deleteSubcategoryAction}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  )
}
