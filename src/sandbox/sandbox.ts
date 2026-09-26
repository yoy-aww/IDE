import type { WorkerRequest, WorkerResult } from './types'

// ─── Worker 生命周期管理 ───────────────────────────────────────────────
// 解释器是同步阻塞的，Worker 内 setTimeout 无法触发。
// 超时必须在主线程管理：setTimeout → worker.terminate()

let worker: Worker | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null
let isExecuting = false

const TIMEOUT_MS = 5000

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../../worker/interpreter.worker.ts', import.meta.url),
      { type: 'module' }
    )
  }
  return worker!
}

function createFreshWorker(): Worker {
  if (worker) {
    worker.terminate()
    worker = null
  }
  return getWorker()
}

function clearTimeoutSafe(): void {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

// ─── 运行 ──────────────────────────────────────────────────────────────

interface RunOptions {
  code: string
  stdin?: string
  timeout?: number
  onResult: (result: WorkerResult) => void
  onTimeout: () => void
}

function run(options: RunOptions): void {
  const { code, stdin = '', timeout = TIMEOUT_MS, onResult, onTimeout } = options
  const start = performance.now()

  clearTimeoutSafe()

  if (isExecuting) {
    onResult({ type: 'error', errorMessage: '上一次执行还未完成' })
    return
  }

  isExecuting = true
  const w = createFreshWorker()

  // 主线程超时控制
  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()
    worker = null
    onTimeout()
  }, timeout)

  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    isExecuting = false
    clearTimeoutSafe()
    const elapsed = Math.round(performance.now() - start)
    e.data.duration = elapsed
    onResult(e.data)
    w.terminate()
    worker = null
  }

  w.onerror = (e: ErrorEvent) => {
    isExecuting = false
    clearTimeoutSafe()
    w.terminate()
    worker = null
    onResult({ type: 'error', errorMessage: `执行错误: ${e.message}` })
  }

  const msg: WorkerRequest = {
    type: 'run',
    code,
    stdin,
    breakpoints: [],
  }

  w.postMessage(msg)
}

// ─── 调试 ──────────────────────────────────────────────────────────────

interface DebugOptions {
  code: string
  stdin: string
  breakpoints: number[]
  currentLine?: number
  debugMode?: 'next' | 'into' | 'out'
  onResult: (result: WorkerResult) => void
  onTimeout: () => void
}

function debugStart(options: DebugOptions): void {
  const { code, stdin, breakpoints, onResult, onTimeout } = options
  const start = performance.now()

  clearTimeoutSafe()

  isExecuting = true
  const w = createFreshWorker()

  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()
    worker = null
    onTimeout()
  }, TIMEOUT_MS)

  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    isExecuting = false
    clearTimeoutSafe()
    const elapsed = Math.round(performance.now() - start)
    e.data.duration = elapsed
    onResult(e.data)
    w.terminate()
    worker = null
  }

  w.onerror = (e: ErrorEvent) => {
    isExecuting = false
    clearTimeoutSafe()
    w.terminate()
    worker = null
    onResult({ type: 'error', errorMessage: `执行错误: ${e.message}` })
  }

  w.postMessage({
    type: 'debug_start',
    code,
    stdin,
    breakpoints,
  } as WorkerRequest)
}

function debugStep(options: DebugOptions): void {
  const { code, stdin, breakpoints, currentLine = 0, debugMode = 'next', onResult, onTimeout } = options
  const start = performance.now()

  clearTimeoutSafe()

  isExecuting = true
  const w = createFreshWorker()

  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()
    worker = null
    onTimeout()
  }, TIMEOUT_MS)

  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    isExecuting = false
    clearTimeoutSafe()
    const elapsed = Math.round(performance.now() - start)
    e.data.duration = elapsed
    onResult(e.data)
    w.terminate()
    worker = null
  }

  w.onerror = (e: ErrorEvent) => {
    isExecuting = false
    clearTimeoutSafe()
    w.terminate()
    worker = null
    onResult({ type: 'error', errorMessage: `执行错误: ${e.message}` })
  }

  w.postMessage({
    type: 'debug_step',
    code,
    stdin,
    breakpoints,
    currentLine,
    debugMode,
  } as WorkerRequest)
}

function debugContinue(options: DebugOptions): void {
  const { code, stdin, breakpoints, currentLine = 0, onResult, onTimeout } = options
  const start = performance.now()

  clearTimeoutSafe()

  isExecuting = true
  const w = createFreshWorker()

  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()
    worker = null
    onTimeout()
  }, TIMEOUT_MS)

  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    isExecuting = false
    clearTimeoutSafe()
    const elapsed = Math.round(performance.now() - start)
    e.data.duration = elapsed
    onResult(e.data)
    w.terminate()
    worker = null
  }

  w.onerror = (e: ErrorEvent) => {
    isExecuting = false
    clearTimeoutSafe()
    w.terminate()
    worker = null
    onResult({ type: 'error', errorMessage: `执行错误: ${e.message}` })
  }

  w.postMessage({
    type: 'debug_continue',
    code,
    stdin,
    breakpoints,
    currentLine,
  } as WorkerRequest)
}

// ─── 中断 ──────────────────────────────────────────────────────────────

function interrupt(): void {
  if (!worker) return
  clearTimeoutSafe()
  isExecuting = false
  worker.terminate()
  worker = null
}

// ─── 状态 ──────────────────────────────────────────────────────────────

function isRunning(): boolean {
  return isExecuting
}

export const sandbox = {
  run,
  interrupt,
  isRunning,
  debugStart,
  debugStep,
  debugContinue,
}
