import { describe, expect, it } from 'vitest'
import { fuzzyFilter, fuzzyScore } from './fuzzy'

describe('T35.7 fuzzy palette search', () => {
  it('matches subsequences only, case-insensitively', () => {
    expect(fuzzyScore('gil', 'Dr. Manjit Gill')).not.toBeNull()
    expect(fuzzyScore('MGL', 'Dr. Manjit Gill')).not.toBeNull()
    expect(fuzzyScore('lig', 'Dr. Manjit Gill')).toBeNull()
    expect(fuzzyScore('', 'anything')).toBe(0)
  })

  it('ranks contiguous and word-start hits first', () => {
    const items = ['Data Structures Lab', 'CSE-Y2-A', 'Discrete Mathematics', 'DS · Data Structures']
    expect(fuzzyFilter(items, 'ds', (s) => s)[0]).toBe('DS · Data Structures')
    expect(fuzzyFilter(items, 'cse y2', (s) => s)).toEqual(['CSE-Y2-A'])
    expect(fuzzyFilter(items, 'lab', (s) => s)).toEqual(['Data Structures Lab'])
  })

  it('empty query keeps every item in order', () => {
    expect(fuzzyFilter(['b', 'a', 'c'], '', (s) => s)).toEqual(['b', 'a', 'c'])
  })
})
