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

/**
 * 将技术性错误消息转换为少儿友好的提示
 */
function friendlyError(msg: string): string {
  // 语法错误
  if (msg.includes('意外的 token')) {
    return `语法错误：这里有个符号放错位置了。${msg}`
  }
  if (msg.includes('期望')) {
    return `语法错误：这里应该写一个特定的符号。${msg}`
  }
  // 超时
  if (msg.includes('超时')) {
    return '⏰ 程序执行时间太长啦！检查一下是不是写了无限循环。'
  }
  // 未定义函数
  if (msg.includes('未定义的函数')) {
    return `这个函数还没有定义哦。${msg}`
  }
  // 默认：原样返回
  return msg
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
      errorMessage: friendlyError(msg),
    }
  }
}
