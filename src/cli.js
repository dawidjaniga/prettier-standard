#!/usr/bin/env node

const minimist = require('minimist')
const getStdin = require('get-stdin')
const { ReadableMock } = require('stream-mock')
const { getPathInHostNodeModules } = require('./utils')

const path = require('path')

const cliHelp = `
Usage
  $ prettier-standard [<glob>...]

Options
  --lint  Output linting errors

Examples
  $ prettier-standard 'src/**/*.js'
  $ prettier-standard 'src/**/*.js' --lint
  $ echo 'const {foo} = "bar";' | prettier-standard
`

function help() {
  console.log(cliHelp)
  process.exit(1)
}

async function format(input, flags) {
  const prettierPath = getPathInHostNodeModules('prettierx')

  return new Promise((resolve, reject) => {
    let output = ''

    const oldArgv = process.argv
    const oldWrite = process.stdout.write

    process.on('beforeExit', function() {
      process.argv = oldArgv
      process.stdout.write = oldWrite
      resolve(output)
    })

    if (input.length === 0) {
      process.stdout.write = e => {
        output += e
      }
    }

    const binPath = path.join(prettierPath, 'bin-prettierx.js')
    process.argv = process.argv.slice(0, 1)
    process.argv.push(binPath)
    process.argv.push('--parser', 'babel')
    process.argv.push('--config-precedence', 'file-override')
    process.argv.push('--generator-star-spacing')
    process.argv.push('--space-before-function-paren')
    process.argv.push('--single-quote')
    process.argv.push('--jsx-single-quote')
    process.argv.push('--no-semi')
    process.argv.push('--yield-star-spacing')

    if (input.length > 0) {
      process.argv.push('--write')
      process.argv.push(...input)
    }

    require(binPath)
  })
}

let CLIEngine
let cliEngine

async function lint(text, input, flags) {
  if (!CLIEngine) {
    const eslintPath = getPathInHostNodeModules('eslint')
    CLIEngine = require(eslintPath).CLIEngine
    cliEngine = new CLIEngine(require('./'))
  }

  let report

  if (input.length > 0) {
    report = cliEngine.executeOnFiles(input)
  } else {
    report = cliEngine.executeOnText(text)
  }

  let formatter
  try {
    formatter = cliEngine.getFormatter(flags.formatter)
  } catch (e) {
    console.error(e.message)
    return false
  }

  const output = formatter(report.results)
  process.stderr.write(output)

  if (report.errorCount > 0) {
    process.exit(1)
  }
}

async function main() {
  const flags = require('minimist')(process.argv.slice(2))
  const input = flags._

  if ((process.stdin.isTTY === true && input.length < 1) || flags.help) {
    help()
  }

  let text = ''

  if (input.length === 0) {
    text = await getStdin()
    const stdin = new ReadableMock([text])
    stdin.isTTY = process.stdin.isTTY
    Object.defineProperty(process, 'stdin', {
      value: stdin,
      configurable: true,
      writable: false
    })
  }

  const output = await format(input, flags)

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  } else {
    process.stdout.write(output)
  }

  if (flags.lint) {
    await lint(text, input, flags)
  }
}

main()
