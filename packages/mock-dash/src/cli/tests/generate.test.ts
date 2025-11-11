import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runSchemaGenerator } from '../generate'
import { parseArgs } from '../parse-args'

const OUTPUT_TS = 'mock-dash-schema.test-gen.ts'

function removeOutput() {
  const dest = path.resolve(process.cwd(), OUTPUT_TS)
  if (fs.existsSync(dest)) fs.unlinkSync(dest)
}

describe('runSchemaGenerator CLI integration', () => {
  beforeEach(() => {
    removeOutput()
  })

  afterEach(() => {
    removeOutput()
  })

  it('generates schema from relative swagger.json', async () => {
    const jsonSpecPath = './src/cli/tests/swagger.json'
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')
    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const sessionModel = /)
    // Assert some endpoint definitions (camelCased)
    expect(contents).toMatch(
      /export const postSignInSocial = definePost\("\/sign-in\/social"/,
    )
    expect(contents).toMatch(
      /export const getGetSession = defineGet\("\/get-session"/,
    )
  })

  it('generates schema from swagger.json', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')
    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const sessionModel = /)
    // Assert some endpoint definitions (camelCased)
    expect(contents).toMatch(
      /export const postSignInSocial = definePost\("\/sign-in\/social"/,
    )
    expect(contents).toMatch(
      /export const getGetSession = defineGet\("\/get-session"/,
    )
  })

  it('generates schema from swagger.yaml', async () => {
    const yamlSpecPath = path.resolve(__dirname, 'swagger.yaml')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      yamlSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')
    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const accountModel = /)
    // Assert an endpoint definition from yaml
    expect(contents).toMatch(
      /export const postSignUpEmail = definePost\("\/sign-up\/email"/,
    )
  })

  it('generates schema with comma-separated prefixes', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-prefixed.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '--prefix',
      '/api/v1,/api/v2',
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const productModel = /)

    // Assert endpoints with stripped prefixes and alias options
    expect(contents).toMatch(
      /export const getApiUsers = defineGet\("\{api\}\/users", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiUsersId = defineGet\("\{api\}\/users\/:id", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProducts = defineGet\("\{api\}\/products", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProductsId = defineGet\("\{api\}\/products\/:id", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )

    // Assert endpoint without alias remains unchanged (no alias option)
    expect(contents).toMatch(
      /export const getHealth = defineGet\("\/health", .+\)$/m,
    )
    expect(contents).not.toMatch(/getHealth.*alias/)
  })

  it('generates schema with multiple prefix arguments', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-prefixed.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '--prefix',
      '/api/v1',
      '--prefix',
      '/api/v2',
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const productModel = /)

    // Assert endpoints with stripped prefixes and alias options
    expect(contents).toMatch(
      /export const getApiUsers = defineGet\("\{api\}\/users", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiUsersId = defineGet\("\{api\}\/users\/:id", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProducts = defineGet\("\{api\}\/products", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProductsId = defineGet\("\{api\}\/products\/:id", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )

    // Assert endpoint without alias remains unchanged (no alias option)
    expect(contents).toMatch(
      /export const getHealth = defineGet\("\/health", .+\)$/m,
    )
    expect(contents).not.toMatch(/getHealth.*alias/)
  })

  it('generates schema with short prefix arguments (-p)', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-prefixed.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '-p',
      '/api/v1',
      '-p',
      '/api/v2',
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const productModel = /)

    // Assert endpoints with stripped prefixes and alias options
    expect(contents).toMatch(
      /export const getApiUsers = defineGet\("\{api\}\/users", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProducts = defineGet\("\{api\}\/products", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )

    // Assert endpoint without alias remains unchanged
    expect(contents).toMatch(
      /export const getHealth = defineGet\("\/health", .+\)$/m,
    )
  })

  it('generates schema with mixed comma-separated and multiple prefix arguments', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-prefixed.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '--prefix',
      '/api/v1',
      '-p',
      '/api/v2,/health',
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert all endpoints now have alias options since /health is also a prefix
    expect(contents).toMatch(
      /export const getApiUsers = defineGet\("\{api\}\/users", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiUsersId = defineGet\("\{api\}\/users\/:id", .+options: \{ alias: \{ "api": "\/api\/v1" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProducts = defineGet\("\{api\}\/products", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getApiProductsId = defineGet\("\{api\}\/products\/:id", .+options: \{ alias: \{ "api": "\/api\/v2" \} \} \}\)/,
    )
    expect(contents).toMatch(
      /export const getHealth = defineGet\("\{health\}\/", .+options: \{ alias: \{ "health": "\/health" \} \} \}\)/,
    )
  })

  it('generates schema with propertiesRequiredByDefault option', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger.json')

    // First, generate without the option (default behavior)
    const argsDefault = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(argsDefault)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contentsDefault = fs.readFileSync(dest, 'utf8')

    // Should have optional properties based on OpenAPI required array
    // User schema has id and image as optional (not in required array)
    expect(contentsDefault).toMatch(
      /userModel.*"id": z\.string\(\)\.optional\(\)/,
    )
    expect(contentsDefault).toMatch(
      /userModel.*"image": z\.string\(\)\.optional\(\)/,
    )
    // name, email, emailVerified should be required (in required array)
    expect(contentsDefault).toMatch(/userModel.*"name": z\.string\(\),/) // name should not have .optional()
    expect(contentsDefault).toMatch(/userModel.*"email": z\.string\(\),/) // email should not have .optional()
    expect(contentsDefault).toMatch(
      /userModel.*"emailVerified": z\.boolean\(\),/,
    ) // emailVerified should not have .optional()
    expect(contentsDefault).not.toMatch(
      /userModel.*"name": z\.string\(\)\.optional\(\)/,
    )
    expect(contentsDefault).not.toMatch(
      /userModel.*"email": z\.string\(\)\.optional\(\)/,
    )

    // Clean up for next generation
    removeOutput()

    // Now generate with propertiesRequiredByDefault option
    const argsRequired = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '--properties-required-by-default',
    ])

    await runSchemaGenerator(argsRequired)

    expect(fs.existsSync(dest)).toBe(true)
    const contentsRequired = fs.readFileSync(dest, 'utf8')

    // All properties should be required (no .optional())
    expect(contentsRequired).toMatch(/"id": z\.string\(\),/) // Should not have .optional()
    expect(contentsRequired).toMatch(/"image": z\.string\(\),/) // Should not have .optional()
    expect(contentsRequired).toMatch(/"name": z\.string\(\),/)
    expect(contentsRequired).toMatch(/"email": z\.string\(\),/)
    // Should not have .optional() anywhere in User schema for id and image
    expect(contentsRequired).not.toMatch(/"id": z\.string\(\)\.optional\(\)/)
    expect(contentsRequired).not.toMatch(/"image": z\.string\(\)\.optional\(\)/)
  })

  it('generates schema with short propertiesRequiredByDefault option (-prbd)', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
      '-prbd',
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // All properties should be required (no .optional())
    expect(contents).toMatch(/"id": z\.string\(\)/)
    expect(contents).toMatch(/"image": z\.string\(\)/)
    expect(contents).not.toMatch(/"id": z\.string\(\)\.optional\(\)/)
    expect(contents).not.toMatch(/"image": z\.string\(\)\.optional\(\)/)
  })

  it('generates schema with parameter $ref support', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-refs.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert component schemas are exported
    expect(contents).toMatch(/export const userModel = /)
    expect(contents).toMatch(/export const productModel = /)
    expect(contents).toMatch(/export const errorModel = /)

    // Assert GET /users/{userId} endpoint with parameter $ref
    expect(contents).toMatch(/export const getUsersUserid = defineGet/)
    expect(contents).toMatch(/param: \{ "userId": z\.string\(\) \}/)
    expect(contents).toMatch(
      /query: \{ "limit": z\.number\(\)\.int\(\)\.optional\(\) \}/,
    )

    // Assert response uses the resolved User schema
    expect(contents).toMatch(/getUsersUserid.*response: userModel/)
  })

  it('generates schema with requestBody $ref support', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-refs.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert PUT /users/{userId} endpoint with requestBody $ref
    expect(contents).toMatch(/export const putUsersUserid = definePut/)
    expect(contents).toMatch(/param: \{ "userId": z\.string\(\) \}/)
    // The requestBody has a $ref to UserRequest, which contains a schema $ref to User
    expect(contents).toMatch(/json: userModel/)
    expect(contents).toMatch(/response: userModel/)
  })

  it('generates schema with response $ref support', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-refs.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert GET /users/{userId} uses response $ref
    expect(contents).toMatch(/getUsersUserid.*response: userModel/)

    // Assert PUT /users/{userId} uses response $ref
    expect(contents).toMatch(/putUsersUserid.*response: userModel/)
  })

  it('generates schema with inline schema $ref in requestBody and response', async () => {
    const jsonSpecPath = path.resolve(__dirname, 'swagger-refs.json')
    const args = parseArgs([
      'node',
      'mock-dash',
      'generate',
      jsonSpecPath,
      '--out',
      OUTPUT_TS,
    ])
    await runSchemaGenerator(args)

    const dest = path.resolve(process.cwd(), OUTPUT_TS)
    expect(fs.existsSync(dest)).toBe(true)
    const contents = fs.readFileSync(dest, 'utf8')

    // Assert POST /products endpoint with schema $ref in content
    expect(contents).toMatch(/export const postProducts = definePost/)
    expect(contents).toMatch(/json: productModel/)
    expect(contents).toMatch(/response: productModel/)
  })

  it('handles unresolved $refs gracefully', async () => {
    // Create a temporary spec with an invalid $ref
    const invalidSpec = {
      openapi: '3.0.0',
      info: { title: 'Invalid Ref Test', version: '1.0.0' },
      components: {
        schemas: {
          User: {
            type: 'object',
            properties: {
              id: { type: 'string' },
            },
          },
        },
      },
      paths: {
        '/test': {
          get: {
            parameters: [
              {
                $ref: '#/components/parameters/NonExistent',
              },
            ],
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/User' },
                  },
                },
              },
            },
          },
        },
      },
    }

    const invalidSpecPath = path.resolve(__dirname, 'swagger-invalid-ref.json')
    fs.writeFileSync(invalidSpecPath, JSON.stringify(invalidSpec, null, 2))

    try {
      const args = parseArgs([
        'node',
        'mock-dash',
        'generate',
        invalidSpecPath,
        '--out',
        OUTPUT_TS,
      ])

      // Capture console output
      const consoleOutput: string[] = []
      const originalLog = console.log
      console.log = (...args: any[]) => {
        consoleOutput.push(args.join(' '))
        originalLog(...args)
      }

      await runSchemaGenerator(args)

      console.log = originalLog

      // Should have generated file despite warning
      const dest = path.resolve(process.cwd(), OUTPUT_TS)
      expect(fs.existsSync(dest)).toBe(true)

      // Should have logged a warning about unresolved ref
      expect(
        consoleOutput.some((line) =>
          line.includes('Warning: Could not resolve parameter $ref'),
        ),
      ).toBe(true)

      const contents = fs.readFileSync(dest, 'utf8')
      // Should still generate the endpoint with valid parts
      expect(contents).toMatch(/export const getTest = defineGet/)
    } finally {
      // Clean up
      if (fs.existsSync(invalidSpecPath)) {
        fs.unlinkSync(invalidSpecPath)
      }
    }
  })
})
