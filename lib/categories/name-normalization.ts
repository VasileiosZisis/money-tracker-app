function hasCasedCharacter (value: string) {
  return Array.from(value).some(
    character => character.toUpperCase() !== character.toLowerCase()
  )
}

function isAllCapsToken (value: string) {
  return hasCasedCharacter(value) && value === value.toUpperCase()
}

function capitalizeFirstCasedCharacter (value: string) {
  let hasCapitalizedCharacter = false

  return Array.from(value)
    .map(character => {
      if (
        !hasCapitalizedCharacter &&
        character.toUpperCase() !== character.toLowerCase()
      ) {
        hasCapitalizedCharacter = true
        return character.toUpperCase()
      }

      return character
    })
    .join('')
}

export function normalizeClassificationName (value: string) {
  let hasHandledFirstCasedCharacter = false

  return value
    .trim()
    .split(/(\s+)/)
    .map(token => {
      if (token.trim().length === 0) {
        return token
      }

      const tokenHasCasedCharacter = hasCasedCharacter(token)

      if (isAllCapsToken(token)) {
        hasHandledFirstCasedCharacter = true
        return token
      }

      const lowercasedToken = token.toLowerCase()

      if (hasHandledFirstCasedCharacter || !tokenHasCasedCharacter) {
        return lowercasedToken
      }

      hasHandledFirstCasedCharacter = true
      return capitalizeFirstCasedCharacter(lowercasedToken)
    })
    .join('')
}

export function buildClassificationNameLookupKey (value: string) {
  return normalizeClassificationName(value).toLowerCase()
}

export function normalizeImportedClassificationName (value: string) {
  return normalizeClassificationName(value.trim().replace(/\s+/g, ' '))
}
