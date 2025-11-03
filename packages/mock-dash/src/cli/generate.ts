import * as fs from 'node:fs'
import * as http from 'node:http'
import * as https from 'node:https'
import * as path from 'node:path'
import {
  IJsonSchema,
  type OpenAPIV2,
  type OpenAPIV3,
  type OpenAPIV3_1,
} from 'openapi-types'
import type { HttpMethod } from '../http-endpoint/http-endpoint'
import { normalizePrefix } from '../utils/normalize-prefix'
import type { GenerateCliOptions } from './parse-args'

let yaml: typeof import('yaml') | undefined

function isUrl(target: string) {
  return /^https?:\/\//i.test(target)
}

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    lib
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`Request failed with status ${res.statusCode}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (d) => chunks.push(d))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
  })
}

interface GenContext {
  components: Map<string, string> // component name -> schema expression
  resolving: Set<string>
  spec: any
  propertiesRequiredByDefault: boolean
}

function ensureComponent(name: string, schema: any, ctx: GenContext) {
  if (ctx.components.has(name)) return
  if (ctx.resolving.has(name)) return // prevent circular loop
  ctx.resolving.add(name)
  const expr = toZodExpr(schema, ctx)
  ctx.components.set(name, expr)
  ctx.resolving.delete(name)
}

function refName(ref: string) {
  // e.g. #/components/schemas/Activity
  const parts = ref.split('/')
  return parts[parts.length - 1]
}

function getSchemaFromRef(ref: string, ctx: GenContext) {
  const name = refName(ref)
  const target = ctx.spec?.components?.schemas?.[name]
  if (!target) return 'z.unknown()'
  ensureComponent(name, target, ctx)
  const camelCaseName = apiPathToCamelCase(name)
  return `${camelCaseName}Model`
}

function primitiveStringExpr(schema: any): string {
  let base = 'z'
  switch (schema.format) {
    case 'email':
      base += '.email()'
      break
    case 'uuid':
      base += '.uuid()'
      break
    case 'date-time':
      base += '.iso.datetime()'
      break
    case 'uri':
    case 'url':
      base += '.url()'
      break
    default:
      base += '.string()'
      break
  }
  return base
}

function toZodExpr(schema: any, ctx: GenContext): string {
  if (!schema || typeof schema !== 'object') return 'z.unknown()'
  if (schema.$ref) return getSchemaFromRef(schema.$ref, ctx)
  const nullableWrap = (expr: string) =>
    schema.nullable ? `${expr}.nullable()` : expr
  if (schema.oneOf || schema.anyOf || schema.allOf) {
    const variants = (schema.oneOf || schema.anyOf || schema.allOf) as any[]
    if (variants?.length) {
      const unionExpr = variants.map((s) => toZodExpr(s, ctx)).join(', ')
      return nullableWrap(`z.union([${unionExpr}])`)
    }
  }
  switch (schema.type) {
    case 'string':
      return nullableWrap(primitiveStringExpr(schema))
    case 'integer':
      return nullableWrap('z.number().int()')
    case 'number':
      return nullableWrap('z.number()')
    case 'boolean':
      return nullableWrap('z.boolean()')
    case 'array': {
      const itemExpr = schema.items
        ? toZodExpr(schema.items, ctx)
        : 'z.unknown()'
      return nullableWrap(`z.array(${itemExpr})`)
    }
    // case 'object':
    default: {
      const props = schema.properties || {}
      const required: string[] = schema.required || []
      const entries: string[] = []
      for (const [key, propSchema] of Object.entries<any>(props)) {
        let propExpr = toZodExpr(propSchema, ctx)
        // If propertiesRequiredByDefault is true, treat all properties as required unless explicitly marked optional
        // If propertiesRequiredByDefault is false, use the standard OpenAPI required array
        const isRequired =
          ctx.propertiesRequiredByDefault || required.includes(key)
        if (!isRequired) propExpr += '.optional()'
        entries.push(`${JSON.stringify(key)}: ${propExpr}`)
      }
      return nullableWrap(`z.object({ ${entries.join(', ')} })`)
    }
  }
}

interface EndpointDef {
  path: string
  method: HttpMethod
  input: { query?: string; param?: string; json?: string; form?: string }
  response: string
  prefix?: string
}

function buildMockDashSchema(
  spec: OpenAPIV3.Document | OpenAPIV3_1.Document,
  prefixes: string[] = [],
  propertiesRequiredByDefault: boolean = false,
): {
  endpoints: EndpointDef[]
  components: Map<string, string>
} {
  if (!spec.paths || typeof spec.paths !== 'object') {
    throw new Error('No paths found in the OpenAPI specification.')
  }
  const ctx: GenContext = {
    components: new Map<string, string>(),
    resolving: new Set<string>(),
    spec,
    propertiesRequiredByDefault,
  }

  // Pre-register component schemas so that references can resolve consistently
  const compSchemas = spec.components?.schemas || {}
  for (const [name, schema] of Object.entries<any>(compSchemas)) {
    ensureComponent(name, schema, ctx)
  }

  const endpoints: EndpointDef[] = []

  for (const rawPath of Object.keys(spec.paths)) {
    const pathItem = spec.paths[rawPath]!

    for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
      const endpoint = pathItem[method]!

      // Check if the path starts with any of the provided prefixes
      let detectedPrefix: string | undefined
      let strippedPath = rawPath

      for (const prefix of prefixes) {
        const normalizedPrefix = normalizePrefix(prefix)
        if (rawPath.startsWith(normalizedPrefix)) {
          detectedPrefix = normalizedPrefix
          strippedPath = rawPath.slice(normalizedPrefix.length)
          // Ensure stripped path starts with /
          if (!strippedPath.startsWith('/')) {
            strippedPath = `/${strippedPath}`
          }
          break
        }
      }

      const colonPath = strippedPath.replace(/\{([^}]+)\}/g, ':$1')
      const path = colonPath.startsWith('/') ? colonPath : `/${colonPath}`
      const input: EndpointDef['input'] = {}

      if (endpoint.parameters) {
        const queryEntries: string[] = []
        const paramEntries: string[] = []

        for (const param of endpoint.parameters) {
          if ('$ref' in param) {
            // TODO: support parameter $ref
            console.log(
              'Warning: Parameter $ref not supported in this generator.',
            )
            continue
          }

          // Use param schema converting to expression
          const expr = toZodExpr(param.schema, ctx)
          if (param.in === 'query') {
            queryEntries.push(
              `${JSON.stringify(param.name)}: ${param.required ? expr : `${expr}.optional()`}`,
            )
          } else if (param.in === 'path') {
            paramEntries.push(`${JSON.stringify(param.name)}: ${expr}`)
          }
        }

        if (queryEntries.length) input.query = `{ ${queryEntries.join(', ')} }`

        if (paramEntries.length) input.param = `{ ${paramEntries.join(', ')} }`
      }

      if (endpoint.requestBody) {
        if ('$ref' in endpoint.requestBody) {
          // TODO: support requestBody $ref
          console.log(
            'Warning: requestBody $ref not supported in this generator.',
          )
        } else {
          const content = endpoint.requestBody.content
          const jsonLikeKey = Object.keys(content).find((k) =>
            k.includes('application/json'),
          )
          const jsonSchema = jsonLikeKey
            ? content[jsonLikeKey]?.schema
            : undefined
          if (jsonSchema) {
            if ('$ref' in jsonSchema) {
              // TODO: support jsonSchema $ref
              console.log(
                'Warning: jsonSchema $ref not supported in this generator.',
              )
            } else input.json = toZodExpr(jsonSchema, ctx)
          }

          const formLikeKey = Object.keys(content).find(
            (k) =>
              k.includes('application/x-www-form-urlencoded') ||
              k.includes('multipart/form-data'),
          )
          const formSchema = formLikeKey
            ? content[formLikeKey]?.schema
            : undefined
          if (formSchema) {
            if ('$ref' in formSchema) {
              // TODO: support formSchema $ref
              console.log(
                'Warning: formSchema $ref not supported in this generator.',
              )
            } else input.form = toZodExpr(formSchema, ctx)
          }
        }
      }

      let response: string = 'z.void()'
      const prefStatus = ['200', '201', 'default']
      let chosen: (typeof endpoint.responses)[string] | undefined
      for (const code of prefStatus) {
        if (endpoint.responses[code]) {
          chosen = endpoint.responses[code]
          break
        }
      }
      if (!chosen) {
        // fallback first response
        const firstKey = Object.keys(endpoint.responses)[0]
        chosen = endpoint.responses[firstKey]
      }

      if ('$ref' in chosen) {
        // TODO: support response $ref
        console.log('Warning: response $ref not supported in this generator.')
      } else if (chosen?.content) {
        const jsonLikeKey = Object.keys(chosen.content).find((k) =>
          k.includes('application/json'),
        )

        const respSchema = jsonLikeKey
          ? chosen.content[jsonLikeKey]?.schema
          : undefined

        if (respSchema) {
          response = toZodExpr(respSchema, ctx)
        }
      }

      endpoints.push({
        path,
        method,
        input,
        response,
        prefix: detectedPrefix,
      })
    }
  }

  return { endpoints, components: ctx.components }
}

async function readSpec(input: string) {
  let raw: string
  if (isUrl(input)) {
    raw = await fetchUrl(input)
  } else {
    const abs = path.resolve(process.cwd(), input)
    raw = fs.readFileSync(abs, 'utf8')
  }
  const isYaml = /\.ya?ml$/i.test(input) || /^---/.test(raw)
  let data: any
  if (isYaml) {
    yaml = yaml ?? (await import('yaml'))
    data = yaml.parse(raw)
  } else {
    data = JSON.parse(raw)
  }
  return data
}

function apiPathToCamelCase(apiPath: string): string {
  // 1. Remove non-alphanumeric characters but keep the ones we need for separation (like / or : for params)
  // We'll replace them with spaces first to ensure proper word separation for camelCase
  const tempName = apiPath
    .replace(/@|:|\//g, ' ') // Replace @, :, and / with a space
    .trim() // Remove leading/trailing spaces

  // 2. Convert the spaced string to camelCase
  let camelCaseName = tempName
    .toLowerCase()
    .replace(/[^a-zA-Z0-9]+(.)/g, (_match, char) => {
      return char.toUpperCase()
    })

  // 3. Ensure the result is valid by removing any non-alphanumeric characters
  // that might have snuck in (though the regex above should handle most cases)
  camelCaseName = camelCaseName.replace(/[^a-zA-Z0-9]/g, '')

  return camelCaseName
}

function emitTs(data: {
  endpoints: EndpointDef[]
  components: Map<string, string>
}): string {
  const { endpoints, components } = data
  const compDecls = Array.from(components.entries())
    .map(([name, expr]) => {
      const camelCaseName = apiPathToCamelCase(name)
      return `export const ${camelCaseName}Model = ${expr}`
    })
    .join('\n')

  const endpointLines = endpoints
    .map((e) => {
      const inputs: string[] = []
      if (e.input.query) inputs.push(`query: ${e.input.query}`)
      if (e.input.param) inputs.push(`param: ${e.input.param}`)
      if (e.input.json) inputs.push(`json: ${e.input.json}`)
      const inputBlock = inputs.length
        ? `input: { ${inputs.join(', ')} }, `
        : ''
      const responseBlock = `response: ${e.response}`

      const name = apiPathToCamelCase(e.path)

      // Add prefix option if detected
      const optionsBlock = e.prefix
        ? `, { prefix: ${JSON.stringify(e.prefix)} }`
        : ''

      return `export const ${name} = define${e.method[0].toUpperCase() + e.method.slice(1)}(${e.path}, { ${inputBlock}${responseBlock} }${optionsBlock})`
    })
    .join('\n\n')

  return `// Generated by mock-dash CLI
import { z } from 'zod'
import { defineEndpoint } from 'mock-dash'

${compDecls}

${endpointLines}
`
}

export async function runSchemaGenerator({
  input,
  outFile,
  prefixes,
  propertiesRequiredByDefault,
}: GenerateCliOptions) {
  if (!input) {
    console.error('Missing <openapi-file-or-url> argument.')
    printHelpAboutGenerate()
    process.exit(1)
  }

  try {
    const spec = await readSpec(input)
    const schema = buildMockDashSchema(
      spec,
      prefixes,
      propertiesRequiredByDefault,
    )
    const destPath = path.resolve(process.cwd(), outFile)
    fs.writeFileSync(destPath, emitTs(schema))
    console.log(`✔ mock-dash schema generated: ${destPath}`)
  } catch (err: any) {
    console.error('Failed to generate schema:', err.message || err)
    process.exit(1)
  }
}

export function printHelpAboutGenerate() {
  console.log(
    `mock-dash CLI

Usage:
  mock-dash generate <openapi-file-or-url> [--out <file>] [--prefix <prefix>] [--properties-required-by-default]

Options:
  --out, -o <file>                          Output file path (default: mock-dash-schema.ts)
  --prefix, -p <prefix>                     Strip prefix from OpenAPI paths and add as prefix option to defineEndpoint.
                                            Can be used multiple times or comma-separated for multiple prefixes.
  --properties-required-by-default, -prbd   Treat all object properties as required by default, regardless of the
                                            OpenAPI schema's required array.
  --help, -h                                Show this help message

Examples:
  mock-dash generate ./openapi.json
  mock-dash generate ./openapi.yaml --out api-schema.ts
  mock-dash generate https://example.com/openapi.json --prefix /api/v1
  mock-dash generate ./openapi.json --prefix /api/v1,/api/v2
  mock-dash generate ./openapi.json --properties-required-by-default
`,
  )
}
