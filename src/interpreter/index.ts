// ─── 解释器入口 ───────────────────────────────────────────────────────
// 将 lexer + parser + evaluator 串联，对外提供 run(code, stdin) 接口

import { tokenize } from './lexer'
import { Parser } from './parser'
import { Interpreter } from './evaluator'

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  errorLine?: number
  errorCol?: number
  errorMessage?: string
}

export function run(
  code: string,
  stdin: string,
  breakpoints: number[] = []
): RunResult {
  try {
    const tokens = tokenize(code)
    const parser = new Parser(tokens)
    const ast = parser.parse()

    const interpreter = new Interpreter()
    interpreter.setBreakpoints(breakpoints)
    interpreter.run(ast, stdin, breakpoints)

    const { stdout, stderr } = interpreter.getOutput()

    return {
      stdout,
      stderr,
      exitCode: 0,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)

    const match = msg.match(/^(\d+):(\d+)/)
    const errorLine = match ? parseInt(match[1], 10) : undefined
    const errorCol = match ? parseInt(match[2], 10) : undefined

    return {
      stdout: '',
      stderr: '',
      exitCode: -1,
      errorLine,
      errorCol,
      errorMessage: msg,
    }
  }
}
