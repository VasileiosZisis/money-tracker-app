'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const MAX_INITIAL_SUBCATEGORIES = 10

type SubcategoryField = {
  id: number
  name: string
}

function initialSubcategoryFields (): SubcategoryField[] {
  return [{ id: 0, name: '' }]
}

export function CategoryCreateFields () {
  const nextSubcategoryId = useRef(1)
  const [categoryName, setCategoryName] = useState('')
  const [subcategoryFields, setSubcategoryFields] = useState(
    initialSubcategoryFields
  )

  const hasCategoryName = categoryName.trim().length > 0
  const hasReachedSubcategoryLimit =
    subcategoryFields.length >= MAX_INITIAL_SUBCATEGORIES

  function updateCategoryName (name: string) {
    setCategoryName(name)

    if (name.trim().length === 0) {
      setSubcategoryFields(initialSubcategoryFields())
    }
  }

  function updateSubcategoryName (id: number, name: string) {
    setSubcategoryFields(currentFields =>
      currentFields.map(field =>
        field.id === id ? { ...field, name } : field
      )
    )
  }

  function addSubcategoryField () {
    setSubcategoryFields(currentFields => {
      if (currentFields.length >= MAX_INITIAL_SUBCATEGORIES) {
        return currentFields
      }

      const nextField = {
        id: nextSubcategoryId.current,
        name: ''
      }

      nextSubcategoryId.current += 1
      return [...currentFields, nextField]
    })
  }

  function removeSubcategoryField (id: number) {
    setSubcategoryFields(currentFields =>
      currentFields.filter(field => field.id !== id)
    )
  }

  return (
    <>
      <FormField htmlFor='create-category-type' label='Type'>
        <Select
          id='create-category-type'
          name='type'
          defaultValue='EXPENSE'
        >
          <option value='INCOME'>Income</option>
          <option value='EXPENSE'>Expense</option>
        </Select>
      </FormField>

      <FormField htmlFor='create-category-name' label='Category'>
        <Input
          id='create-category-name'
          type='text'
          name='name'
          placeholder='Category name'
          value={categoryName}
          onChange={event => updateCategoryName(event.target.value)}
          required
          maxLength={50}
        />
      </FormField>

      <div className='space-y-3'>
        {subcategoryFields.map((field, index) => {
          const inputId = `create-category-subcategory-${field.id}`

          return (
            <FormField
              key={field.id}
              htmlFor={inputId}
              label={
                index === 0
                  ? 'Optional subcategory'
                  : `Optional subcategory ${index + 1}`
              }
            >
              <div className='flex gap-2'>
                <Input
                  id={inputId}
                  type='text'
                  name='subcategoryNames'
                  placeholder='Subcategory name'
                  value={field.name}
                  onChange={event =>
                    updateSubcategoryName(field.id, event.target.value)
                  }
                  disabled={!hasCategoryName}
                  maxLength={50}
                />
                {index > 0 ? (
                  <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    aria-label={`Remove subcategory ${index + 1}`}
                    onClick={() => removeSubcategoryField(field.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            </FormField>
          )
        })}

        <Button
          type='button'
          variant='outline'
          className='w-full'
          disabled={!hasCategoryName || hasReachedSubcategoryLimit}
          onClick={addSubcategoryField}
        >
          <Plus />
          Add subcategory
        </Button>
      </div>
    </>
  )
}
