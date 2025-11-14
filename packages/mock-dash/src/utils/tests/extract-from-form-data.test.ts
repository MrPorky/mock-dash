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

  describe('array with objects extraction', () => {
    it('should extract arrays of objects using indexed dot notation', () => {
      const schema = z.object({
        name: z.string(),
        users: z.array(
          z.object({
            name: z.string(),
            email: z.string(),
            age: z.coerce.number(),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('name', 'User List')
      formData.append('users[0].name', 'John Doe')
      formData.append('users[0].email', 'john@example.com')
      formData.append('users[0].age', '25')
      formData.append('users[1].name', 'Jane Smith')
      formData.append('users[1].email', 'jane@example.com')
      formData.append('users[1].age', '30')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'User List',
          users: [
            { name: 'John Doe', email: 'john@example.com', age: 25 },
            { name: 'Jane Smith', email: 'jane@example.com', age: 30 },
          ],
        })
      }
    })

    it('should handle arrays of objects with optional fields', () => {
      const schema = z.object({
        products: z.array(
          z.object({
            name: z.string(),
            price: z.coerce.number(),
            description: z.string().optional(),
            category: z.string().optional(),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('products[0].name', 'Laptop')
      formData.append('products[0].price', '999.99')
      formData.append('products[0].description', 'High-end laptop')
      formData.append('products[1].name', 'Mouse')
      formData.append('products[1].price', '25.50')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          products: [
            { name: 'Laptop', price: 999.99, description: 'High-end laptop' },
            { name: 'Mouse', price: 25.5 },
          ],
        })
      }
    })

    it('should handle nested objects within array items', () => {
      const schema = z.object({
        employees: z.array(
          z.object({
            name: z.string(),
            contact: z.object({
              email: z.string(),
              phone: z.string().optional(),
            }),
            address: z.object({
              street: z.string(),
              city: z.string(),
              country: z.string().default('US'),
            }),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('employees[0].name', 'Alice Johnson')
      formData.append('employees[0].contact.email', 'alice@company.com')
      formData.append('employees[0].contact.phone', '+1-555-0101')
      formData.append('employees[0].address.street', '123 Main St')
      formData.append('employees[0].address.city', 'New York')
      formData.append('employees[1].name', 'Bob Wilson')
      formData.append('employees[1].contact.email', 'bob@company.com')
      formData.append('employees[1].address.street', '456 Oak Ave')
      formData.append('employees[1].address.city', 'Los Angeles')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          employees: [
            {
              name: 'Alice Johnson',
              contact: { email: 'alice@company.com', phone: '+1-555-0101' },
              address: {
                street: '123 Main St',
                city: 'New York',
                country: 'US',
              },
            },
            {
              name: 'Bob Wilson',
              contact: { email: 'bob@company.com' },
              address: {
                street: '456 Oak Ave',
                city: 'Los Angeles',
                country: 'US',
              },
            },
          ],
        })
      }
    })

    it('should handle arrays within array objects', () => {
      const schema = z.object({
        teams: z.array(
          z.object({
            name: z.string(),
            members: z.array(z.string()),
            skills: z.array(z.string()),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('teams[0].name', 'Frontend Team')
      formData.append('teams[0].members', 'Alice')
      formData.append('teams[0].members', 'Bob')
      formData.append('teams[0].skills', 'React')
      formData.append('teams[0].skills', 'TypeScript')
      formData.append('teams[1].name', 'Backend Team')
      formData.append('teams[1].members', 'Charlie')
      formData.append('teams[1].skills', 'Node.js')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          teams: [
            {
              name: 'Frontend Team',
              members: ['Alice', 'Bob'],
              skills: ['React', 'TypeScript'],
            },
            {
              name: 'Backend Team',
              members: ['Charlie'],
              skills: ['Node.js'],
            },
          ],
        })
      }
    })

    it('should handle sparse arrays with gaps in indices', () => {
      const schema = z.object({
        items: z.array(
          z.object({
            name: z.string(),
            value: z.coerce.number(),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('items[0].name', 'First Item')
      formData.append('items[0].value', '100')
      formData.append('items[2].name', 'Third Item')
      formData.append('items[2].value', '300')
      formData.append('items[4].name', 'Fifth Item')
      formData.append('items[4].value', '500')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          items: [
            { name: 'First Item', value: 100 },
            { name: 'Third Item', value: 300 },
            { name: 'Fifth Item', value: 500 },
          ],
        })
      }
    })

    it('should handle empty arrays of objects', () => {
      const schema = z.object({
        name: z.string(),
        items: z.array(
          z.object({
            title: z.string(),
            price: z.coerce.number(),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('name', 'Empty List')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Empty List',
          items: [],
        })
      }
    })

    it('should handle optional arrays of objects', () => {
      const schema = z.object({
        name: z.string(),
        items: z
          .array(
            z.object({
              title: z.string(),
              price: z.coerce.number(),
            }),
          )
          .optional(),
      })

      const formData = new FormData()
      formData.append('name', 'Test')
      formData.append('items[0].title', 'Item 1')
      formData.append('items[0].price', '10')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          name: 'Test',
          items: [{ title: 'Item 1', price: 10 }],
        })
      }
    })

    it('should handle complex mixed structures with array objects', () => {
      const schema = z.object({
        project: z.object({
          name: z.string(),
          tasks: z.array(
            z.object({
              title: z.string(),
              assignees: z.array(z.string()),
              metadata: z.object({
                priority: z.string(),
                estimatedHours: z.coerce.number(),
                tags: z.array(z.string()),
              }),
            }),
          ),
        }),
        settings: z.object({
          notifications: z.coerce.boolean(),
        }),
      })

      const formData = new FormData()
      formData.append('project.name', 'Web App')
      formData.append('project.tasks[0].title', 'Setup Database')
      formData.append('project.tasks[0].assignees', 'John')
      formData.append('project.tasks[0].assignees', 'Jane')
      formData.append('project.tasks[0].metadata.priority', 'high')
      formData.append('project.tasks[0].metadata.estimatedHours', '8')
      formData.append('project.tasks[0].metadata.tags', 'backend')
      formData.append('project.tasks[0].metadata.tags', 'database')
      formData.append('project.tasks[1].title', 'Design UI')
      formData.append('project.tasks[1].assignees', 'Alice')
      formData.append('project.tasks[1].metadata.priority', 'medium')
      formData.append('project.tasks[1].metadata.estimatedHours', '12')
      formData.append('project.tasks[1].metadata.tags', 'frontend')
      formData.append('settings.notifications', 'true')

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({
          project: {
            name: 'Web App',
            tasks: [
              {
                title: 'Setup Database',
                assignees: ['John', 'Jane'],
                metadata: {
                  priority: 'high',
                  estimatedHours: 8,
                  tags: ['backend', 'database'],
                },
              },
              {
                title: 'Design UI',
                assignees: ['Alice'],
                metadata: {
                  priority: 'medium',
                  estimatedHours: 12,
                  tags: ['frontend'],
                },
              },
            ],
          },
          settings: {
            notifications: true,
          },
        })
      }
    })

    it('should validate array object fields and fail appropriately', () => {
      const schema = z.object({
        users: z.array(
          z.object({
            name: z.string().min(2),
            age: z.coerce.number().min(0).max(150),
            email: z.string().email(),
          }),
        ),
      })

      const formData = new FormData()
      formData.append('users[0].name', 'A') // Too short
      formData.append('users[0].age', '200') // Too high
      formData.append('users[0].email', 'invalid-email') // Invalid email

      const result = extractFromFormData(formData, schema)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeDefined()
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
