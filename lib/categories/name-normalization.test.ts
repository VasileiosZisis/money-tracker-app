import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildClassificationNameLookupKey,
  normalizeClassificationName,
  normalizeImportedClassificationName
} from '@/lib/categories/name-normalization'
import {
  categoryNameSchema,
  createCategorySchema
} from '@/lib/validators/category'
import { subcategoryNameSchema } from '@/lib/validators/subcategory'

test('normalizes category-style names to sentence case', () => {
  assert.equal(normalizeClassificationName('gROCERIES'), 'Groceries')
  assert.equal(normalizeClassificationName('home utilities'), 'Home utilities')
  assert.equal(normalizeClassificationName('WiFi'), 'Wifi')
})

test('trims surrounding whitespace without changing internal whitespace', () => {
  assert.equal(
    normalizeClassificationName('  home   utilities  '),
    'Home   utilities'
  )
})

test('collapses internal whitespace for imported names', () => {
  assert.equal(
    normalizeImportedClassificationName('  home   ATM   fees  '),
    'Home ATM fees'
  )
})

test('preserves whitespace-delimited all-caps tokens', () => {
  assert.equal(normalizeClassificationName('home ATM fees'), 'Home ATM fees')
  assert.equal(normalizeClassificationName('ATM withdrawal'), 'ATM withdrawal')
  assert.equal(normalizeClassificationName('HOME UTILITIES'), 'HOME UTILITIES')
})

test('capitalizes the first cased character after punctuation or numbers', () => {
  assert.equal(normalizeClassificationName('(gROCERIES)'), '(Groceries)')
  assert.equal(normalizeClassificationName('24/7 gROCERIES'), '24/7 Groceries')
})

test('builds case-insensitive lookup keys independently of acronym display', () => {
  assert.equal(buildClassificationNameLookupKey('ATM'), 'atm')
  assert.equal(buildClassificationNameLookupKey('Atm'), 'atm')
  assert.equal(buildClassificationNameLookupKey('atm'), 'atm')
})

test('normalizes category and subcategory validator outputs', () => {
  assert.equal(categoryNameSchema.parse('hOME utilities'), 'Home utilities')
  assert.equal(subcategoryNameSchema.parse('ATM fEES'), 'ATM fees')
})

test('rejects case-insensitive initial subcategory duplicates', () => {
  const result = createCategorySchema.safeParse({
    name: 'Cash',
    type: 'EXPENSE',
    subcategoryNames: ['ATM', 'atm']
  })

  assert.equal(result.success, false)
  if (result.success) {
    assert.fail('Expected duplicate subcategories to fail validation.')
  }

  assert.equal(
    result.error.issues[0]?.message,
    'Subcategory names must be unique.'
  )
})
