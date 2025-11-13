import { describe, expect, it } from 'vitest'
import { buildFormData, serializeQueryParams } from '../request-utils'

describe('request-utils', () => {
  describe('serializeQueryParams', () => {
    it('should serialize simple params', () => {
      const params = { name: 'John', age: 30 }
      const result = serializeQueryParams(params)

      expect(result).toBe('name=John&age=30')
    })

    it('should handle arrays correctly', () => {
      const params = { tags: ['javascript', 'typescript'] }
      const result = serializeQueryParams(params)

      expect(result).toBe('tags=javascript&tags=typescript')
    })

    it('should handle nested objects with bracket notation', () => {
      const params = { user: { name: 'John', age: 30 } }
      const result = serializeQueryParams(params)

      // URLSearchParams encodes brackets
      expect(result).toBe('user%5Bname%5D=John&user%5Bage%5D=30')
    })

    it('should skip null and undefined values', () => {
      const params = { name: 'John', age: null, city: undefined }
      const result = serializeQueryParams(params)

      expect(result).toBe('name=John')
    })

    it('should handle empty arrays by skipping them', () => {
      const params = { tags: [], name: 'John' }
      const result = serializeQueryParams(params)

      expect(result).toBe('name=John')
    })

    it('should handle boolean values', () => {
      const params = { active: true, deleted: false }
      const result = serializeQueryParams(params)

      expect(result).toBe('active=true&deleted=false')
    })

    it('should handle number values', () => {
      const params = { page: 1, limit: 10, offset: 0 }
      const result = serializeQueryParams(params)

      expect(result).toBe('page=1&limit=10&offset=0')
    })

    it('should handle mixed array with null values', () => {
      const params = { ids: [1, null, 3, undefined, 5] }
      const result = serializeQueryParams(params)

      expect(result).toBe('ids=1&ids=3&ids=5')
    })
  })

  describe('buildFormData', () => {
    it('should build FormData from simple object', () => {
      const data = { name: 'John', age: '30' }
      const formData = buildFormData(data)

      expect(formData.get('name')).toBe('John')
      expect(formData.get('age')).toBe('30')
    })

    it('should skip null and undefined values', () => {
      const data = { name: 'John', age: null, city: undefined }
      const formData = buildFormData(data)

      expect(formData.get('name')).toBe('John')
      expect(formData.get('age')).toBeNull()
      expect(formData.get('city')).toBeNull()
    })

    it('should handle File objects correctly', () => {
      const file = new File(['content'], 'test.txt', { type: 'text/plain' })
      const data = { name: 'John', avatar: file }
      const formData = buildFormData(data)

      expect(formData.get('name')).toBe('John')
      expect(formData.get('avatar')).toBeInstanceOf(File)
      expect((formData.get('avatar') as File).name).toBe('test.txt')
    })

    it('should handle arrays of values', () => {
      const data = { tags: ['javascript', 'typescript'] }
      const formData = buildFormData(data)

      expect(formData.getAll('tags')).toEqual(['javascript', 'typescript'])
    })

    it('should handle arrays with File objects', () => {
      const file1 = new File(['content1'], 'test1.txt', { type: 'text/plain' })
      const file2 = new File(['content2'], 'test2.txt', { type: 'text/plain' })
      const data = { files: [file1, file2] }
      const formData = buildFormData(data)

      const files = formData.getAll('files')
      expect(files).toHaveLength(2)
      expect(files[0]).toBeInstanceOf(File)
      expect(files[1]).toBeInstanceOf(File)
      expect((files[0] as File).name).toBe('test1.txt')
      expect((files[1] as File).name).toBe('test2.txt')
    })

    it('should handle boolean and number values', () => {
      const data = { active: true, count: 42 }
      const formData = buildFormData(data)

      expect(formData.get('active')).toBe('true')
      expect(formData.get('count')).toBe('42')
    })
  })
})
