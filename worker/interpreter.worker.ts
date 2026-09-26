// JSCPP is CJS — Vite handles the interop
import JSCPP from 'JSCPP'
import type { WorkerRequest, WorkerResult } from '../src/sandbox/types'

// Worker message handler
self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data

  switch (msg.type) {
    case 'run':
      handleRun(msg.code!, msg.breakpoints || [])
      break
    case 'debug_start':
      handleRun(msg.code!, msg.breakpoints || [])
      break
    case 'debug_step':
      handleDebugStep(msg.stepMode || 'next')
      break
    case 'debug_continue':
      handleDebugContinue()
      break
    case 'debug_interrupt':
      handleInterrupt()
      break
  }
}

let currentCode = ''
let currentBreakpoints: number[] = []

function postResult(result: WorkerResult) {
  self.postMessage(result)
}

function handleRun(code: string, breakpoints: number[] = []) {
  currentCode = code
  currentBreakpoints = breakpoints

  const startTime = performance.now()

  // Capture stdout and stderr through JSCPP config
  let stdout = ''
  let stderr = ''
  let exitCode = 0

  const config = {
    stdio: {
      write: (s: string) => {
        stdout += s
      },
    },
    unsigned_overflow: 'error' as const,
  }

  // Execute with timeout
  const timeoutId = setTimeout(() => {
    postResult({ type: 'timeout' })
  }, 5000)

  try {
    exitCode = JSCPP.run(code, '', config)
    clearTimeout(timeoutId)

    const duration = Math.round(performance.now() - startTime)

    postResult({
      type: 'result',
      stdout,
      stderr,
      exitCode,
      duration,
    })
  } catch (err: unknown) {
    clearTimeout(timeoutId)
    const duration = Math.round(performance.now() - startTime)
    const msg = err instanceof Error ? err.message : String(err)

    // Try to extract line info from error message
    const lineMatch = msg.match(/line\s+(\d+)/i)
    const errorLine = lineMatch ? parseInt(lineMatch[1]) : undefined

    postResult({
      type: 'result',
      stdout,
      stderr: msg,
      exitCode: -1,
      duration,
      errorLine,
      errorMessage: msg,
    })
  }
}

function handleDebugStep(_mode: string) {
  // JSCPP doesn't support step-by-step debugging natively
  postResult({
    type: 'error',
    message: '步进调试功能需要自研解释器支持，当前使用 JSCPP 仅支持运行模式。',
  })
}

function handleDebugContinue() {
  handleRun(currentCode, currentBreakpoints)
}

function handleInterrupt() {
  // JSCPP 不支持异步中断
  postResult({
    type: 'error',
    message: '中断功能需要自研解释器支持。',
  })
}
