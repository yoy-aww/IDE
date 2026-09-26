import { run } from '../src/interpreter'
import { tokenize } from '../src/interpreter/lexer'
import { Parser } from '../src/interpreter/parser'
import { Interpreter, PauseSignal } from '../src/interpreter/evaluator'
import type { WorkerRequest, WorkerResult } from '../src/sandbox/types'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { type, code, stdin, breakpoints, currentLine, debugMode } = e.data
  switch (type) {
    case 'run':
      handleRun(code, stdin)
      break
    case 'debug_start':
      handleDebugStart(code, stdin, breakpoints || [])
      break
    case 'debug_step':
      handleDebugStep(code, stdin, breakpoints || [], currentLine || 0, debugMode || 'next')
      break
    case 'debug_continue':
      handleDebugContinue(code, stdin, breakpoints || [], currentLine || 0)
      break
    case 'debug_stop':
      // 什么都不做，主线程已 terminate worker
      break
  }
}

function handleRun(code: string, stdin: string): void {
  const result = run(code, stdin, [])
  postResult({
    type: 'result',
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
    errorLine: result.errorLine,
    errorCol: result.errorCol,
    errorMessage: result.errorMessage,
  })
}

function handleDebugStart(code: string, stdin: string, breakpoints: number[]): void {
  const tokens = tokenize(code)
  const parser = new Parser(tokens)
  const ast = parser.parse()
  const interpreter = new Interpreter()
  interpreter.setDebugMode(true)
  interpreter.setBreakpoints(breakpoints)
  try {
    interpreter.run(ast as any, stdin, breakpoints)
    postResult({
      type: 'debug_done',
      stdout: interpreter.getOutput().stdout,
    })
  } catch (e) {
    if (e instanceof PauseSignal) {
      postResult({
        type: 'debug_paused',
        debugState: {
          currentLine: e.line,
          variables: e.variables,
          callStack: e.callStack,
          stdout: e.stdout,
          atBreakpoint: e.atBreakpoint,
        },
      })
    } else {
      throw e
    }
  }
}

function handleDebugStep(
  code: string, stdin: string,
  breakpoints: number[], currentLine: number,
  debugMode: 'next' | 'into' | 'out'
): void {
  const tokens = tokenize(code)
  const parser = new Parser(tokens)
  const ast = parser.parse()

  // 探测：获取从 currentLine 之后将要执行的行序列
  const interpreter = new Interpreter()
  interpreter.setDebugMode(false)

  // 先运行到 currentLine（通过 probe 跳过）
  // 然后用 breakpoint 停在下一步
  const bpSet = new Set(breakpoints)

  // 找到下一个要执行的目标行
  // probe 整个程序，获取执行行序列
  const allLines = interpreter.probeLines(ast as any, stdin, [])

  // 找到 currentLine 在序列中的位置
  let startIdx = -1
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i] === currentLine) {
      startIdx = i
      break
    }
  }

  // 找下一个不同的行（即下一步要执行的行）
  let targetLine = currentLine
  if (startIdx >= 0 && startIdx + 1 < allLines.length) {
    targetLine = allLines[startIdx + 1]
  }

  // 设置断点，运行到新位置
  const newInterpreter = new Interpreter()
  newInterpreter.setDebugMode(true)
  newInterpreter.setBreakpoints([targetLine, ...breakpoints])

  try {
    newInterpreter.run(ast as any, stdin, [targetLine, ...breakpoints])
    postResult({
      type: 'debug_done',
      stdout: newInterpreter.getOutput().stdout,
    })
  } catch (e) {
    if (e instanceof PauseSignal) {
      postResult({
        type: 'debug_paused',
        debugState: {
          currentLine: e.line,
          variables: e.variables,
          callStack: e.callStack,
          stdout: e.stdout,
          atBreakpoint: e.atBreakpoint,
        },
      })
    } else {
      throw e
    }
  }
}

function handleDebugContinue(
  code: string, stdin: string,
  breakpoints: number[], currentLine: number
): void {
  const tokens = tokenize(code)
  const parser = new Parser(tokens)
  const ast = parser.parse()

  // 运行，停在下个断点
  const newInterpreter = new Interpreter()
  newInterpreter.setDebugMode(true)
  newInterpreter.setBreakpoints(breakpoints)

  try {
    newInterpreter.run(ast as any, stdin, breakpoints)
    postResult({
      type: 'debug_done',
      stdout: newInterpreter.getOutput().stdout,
    })
  } catch (e) {
    if (e instanceof PauseSignal) {
      postResult({
        type: 'debug_paused',
        debugState: {
          currentLine: e.line,
          variables: e.variables,
          callStack: e.callStack,
          stdout: e.stdout,
          atBreakpoint: e.atBreakpoint,
        },
      })
    } else {
      throw e
    }
  }
}

function postResult(result: WorkerResult): void {
  self.postMessage(result)
}
