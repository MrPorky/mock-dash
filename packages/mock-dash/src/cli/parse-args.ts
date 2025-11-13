import { printHelpAboutGenerate } from './generate'

export type GenerateCliOptions = {
  command: 'generate'
  input: string | undefined
  outFile: string
  prefixes: string[] // Prefixes to strip from paths
  propertiesRequiredByDefault: boolean // Treat schema objects without required as having all properties required.
}

type CliOptions = GenerateCliOptions

export function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2)

  const command = args[0]
  if (command === '--h' || command === '--help') {
    printHelp()
    process.exit(0)
  }

  if (command === 'generate') {
    return parseGenerateArgs(args)
  }

  printHelp()
  process.exit(0)
}

function printHelp() {
  console.log(
    `mock-dash CLI

Usage:
  mock-dash <command> [options]

Commands:
  generate    Generate TypeScript schema from OpenAPI specification

Run 'mock-dash <command> --help' for more information on a command.
`,
  )
}

function parseGenerateArgs(args: string[]): GenerateCliOptions {
  const ctx: GenerateCliOptions = {
    command: 'generate',
    input: args[1],
    outFile: 'mock-dash-schema.ts',
    prefixes: [],
    propertiesRequiredByDefault: false,
  }

  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    if ((arg === '--out' || arg === '-o') && i + 1 < args.length) {
      ctx.outFile = args[i + 1]
      i++
    }

    if ((arg === '--prefix' || arg === '-p') && i + 1 < args.length) {
      const prefix = args[i + 1]
      ctx.prefixes.push(...prefix.split(','))
      i++
    }

    if (arg === '--properties-required-by-default' || arg === '-prbd') {
      ctx.propertiesRequiredByDefault = true
    }

    if (arg === '--help' || arg === '-h') {
      printHelpAboutGenerate()
      process.exit(0)
    }
  }

  return ctx
}
