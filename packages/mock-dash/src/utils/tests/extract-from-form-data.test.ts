import { describe, expect, it } from 'vitest'
import z from 'zod'
import { extractFromFormData } from '../extract-from-form-data'

describe('extractFromFormData', () => {
  describe('basic field extraction', () => {
    it('should extract simple string fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string(),
      })

      const formData = new FormData()
      formData.append('name', 'John Doe')
      formData.append('email', 'john@example.com')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'John Doe',
          email: 'john@example.com',
        })
      }
    })

    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional(),
        age: z.number().optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Jane Doe')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Jane Doe',
        })
      }
    })

    it('should handle default values', () => {
      const schema = z.object({
        name: z.string(),
        role: z.string().default('user'),
        isActive: z.boolean().default(true),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          role: 'user',
          isActive: true,
        })
      }
    })

    it('should handle empty string values as undefined', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Test Item')
      formData.append('description', '')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
        })
      }
    })
  })

  describe('nullable fields', () => {
    it('should handle nullable fields correctly', () => {
      const schema = z.object({
        name: z.string(),
        middleName: z.string().nullable(),
        description: z.string().nullable(),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('middleName', '')
      formData.append('description', 'Some description')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          middleName: null,
          description: 'Some description',
        })
      }
    })

    it('should handle z.null() fields', () => {
      const schema = z.object({
        name: z.string(),
        nullField: z.null(),
      })

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('nullField', '')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test',
          nullField: null,
        })
      }
    })
  })

  describe('array field extraction', () => {
    it('should extract array fields', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()),
      })

      const formData = new FormData()
      formData.append('name', 'Test Item')
      formData.append('tags', 'tag1')
      formData.append('tags', 'tag2')
      formData.append('tags', 'tag3')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
          tags: ['tag1', 'tag2', 'tag3'],
        })
      }
    })

    it('should handle empty arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()),
      })

      const formData = new FormData()
      formData.append('name', 'Test Item')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
          tags: [],
        })
      }
    })

    it('should handle optional arrays', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()).optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Test Item')
      formData.append('tags', 'tag1')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test Item',
          tags: ['tag1'],
        })
      }
    })
  })

  describe('nested object extraction', () => {
    it('should extract nested objects using dot notation', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          zipCode: z.string(),
        }),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('address.street', '123 Main St')
      formData.append('address.city', 'New York')
      formData.append('address.zipCode', '10001')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          address: {
            street: '123 Main St',
            city: 'New York',
            zipCode: '10001',
          },
        })
      }
    })

    it('should handle optional nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z
          .object({
            street: z.string(),
            city: z.string(),
          })
          .optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
        })
      }
    })

    it('should handle partial nested objects', () => {
      const schema = z.object({
        name: z.string(),
        address: z.object({
          street: z.string(),
          city: z.string().optional(),
          zipCode: z.string().optional(),
        }),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('address.street', '123 Main St')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          address: {
            street: '123 Main St',
          },
        })
      }
    })
  })

  describe('deeply nested objects', () => {
    it('should handle deeply nested objects', () => {
      const schema = z.object({
        user: z.object({
          profile: z.object({
            personal: z.object({
              name: z.string(),
              age: z.coerce.number(),
            }),
            contact: z.object({
              email: z.string(),
              phone: z.string().optional(),
            }),
          }),
        }),
      })

      const formData = new FormData()
      formData.append('user.profile.personal.name', 'John Doe')
      formData.append('user.profile.personal.age', '30')
      formData.append('user.profile.contact.email', 'john@example.com')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          user: {
            profile: {
              personal: {
                name: 'John Doe',
                age: 30,
              },
              contact: {
                email: 'john@example.com',
              },
            },
          },
        })
      }
    })
  })

  describe('mixed field types', () => {
    it('should handle mixed field types in nested objects', () => {
      const schema = z.object({
        name: z.string(),
        tags: z.array(z.string()),
        address: z.object({
          street: z.string(),
          coordinates: z.array(z.coerce.number()),
        }),
        metadata: z
          .object({
            createdBy: z.string(),
            isPublic: z.boolean().optional(),
          })
          .optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('tags', 'developer')
      formData.append('tags', 'typescript')
      formData.append('address.street', '123 Main St')
      formData.append('address.coordinates', '40.7128')
      formData.append('address.coordinates', '-74.0060')
      formData.append('metadata.createdBy', 'admin')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          tags: ['developer', 'typescript'],
          address: {
            street: '123 Main St',
            coordinates: [40.7128, -74.006],
          },
          metadata: {
            createdBy: 'admin',
          },
        })
      }
    })

    it('should handle arrays within nested objects', () => {
      const schema = z.object({
        company: z.object({
          name: z.string(),
          employees: z.array(z.string()),
          departments: z.object({
            engineering: z.array(z.string()),
            marketing: z.array(z.string()).optional(),
          }),
        }),
      })

      const formData = new FormData()
      formData.append('company.name', 'Tech Corp')
      formData.append('company.employees', 'John')
      formData.append('company.employees', 'Jane')
      formData.append('company.departments.engineering', 'Backend')
      formData.append('company.departments.engineering', 'Frontend')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          company: {
            name: 'Tech Corp',
            employees: ['John', 'Jane'],
            departments: {
              engineering: ['Backend', 'Frontend'],
            },
          },
        })
      }
    })
  })

  describe('edge cases', () => {
    it('should handle empty form data', () => {
      const schema = z.object({
        name: z.string().optional(),
        age: z.number().optional(),
      })

      const formData = new FormData()

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({})
      }
    })

    it('should handle form data with null values', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string().nullable(),
      })

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.set('description', '')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test',
          description: null,
        })
      }
    })

    it('should handle special characters in field values', () => {
      const schema = z.object({
        name: z.string(),
        description: z.string(),
      })

      const formData = new FormData()
      formData.append('name', 'Test & Co. "Special" <chars>')
      formData.append('description', 'Multi\nline\ttext with émojis 🎉')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test & Co. "Special" <chars>',
          description: 'Multi\nline\ttext with émojis 🎉',
        })
      }
    })

    it('should handle very deep nesting', () => {
      const schema = z.object({
        level1: z.object({
          level2: z.object({
            level3: z.object({
              level4: z.object({
                level5: z.string(),
              }),
            }),
          }),
        }),
      })

      const formData = new FormData()
      formData.append('level1.level2.level3.level4.level5', 'deep value')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          level1: {
            level2: {
              level3: {
                level4: {
                  level5: 'deep value',
                },
              },
            },
          },
        })
      }
    })

    it('should fail validation for invalid data', () => {
      const schema = z.object({
        name: z.string().min(2),
        age: z.number().min(0),
      })

      const formData = new FormData()
      formData.append('name', 'A') // Too short
      formData.append('age', 'invalid') // Not a number

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
      }
    })

    it('should handle mixed dot notation and regular fields', () => {
      const schema = z.object({
        name: z.string(),
        config: z.object({
          theme: z.string(),
          notifications: z.object({
            email: z.coerce.boolean(),
          }),
        }),
        tags: z.array(z.string()),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('config.theme', 'dark')
      formData.append('config.notifications.email', 'true')
      formData.append('tags', 'tag1')
      formData.append('tags', 'tag2')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          config: {
            theme: 'dark',
            notifications: {
              email: true,
            },
          },
          tags: ['tag1', 'tag2'],
        })
      }
    })
  })

  describe('compatibility with existing behavior', () => {
    it('should maintain backward compatibility for flat objects', () => {
      const schema = z.object({
        name: z.string(),
        age: z.coerce.number(),
        isActive: z.coerce.boolean(),
      })

      const formData = new FormData()
      formData.append('name', 'John Doe')
      formData.append('age', '25')
      formData.append('isActive', 'true')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'John Doe',
          age: 25,
          isActive: true,
        })
      }
    })

    it('should maintain behavior for wrapped schemas', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().optional().nullable(),
        tags: z.array(z.string()).default([]),
      })

      const formData = new FormData()
      formData.append('name', 'Test User')
      formData.append('email', '')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test User',
          email: null,
          tags: [],
        })
      }
    })
  })
})
