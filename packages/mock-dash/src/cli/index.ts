#!/usr/bin/env node

import { runSchemaGenerator } from './generate'
import { parseArgs } from './parse-args'

async function main() {
  const cliArguments = parseArgs(process.argv)

  if (cliArguments.command === 'generate') {
    await runSchemaGenerator(cliArguments)
    process.exit(0)
  }

  console.log('Unknown command. Run `mock-dash --help` for more information.')
  process.exit(1)
}

// Ensure zod peer dep is present before running (user must install zod as peer)
try {
  require('zod')
} catch {
  console.error(
    'zod is required as a peer dependency. Please install it: npm install zod',
  )
  process.exit(1)
}

// Run the CLI
void main()
