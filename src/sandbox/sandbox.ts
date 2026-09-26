import type { WorkerRequest, WorkerResult, RunConfig } from './types'

// ─── Worker 生命周期管理 ───────────────────────────────────────────────
// 核心思路：JSCPP.run() 是同步阻塞的，Worker 内的 setTimeout 永远不会触发。
// 所以超时必须在主线程（IDEController）管理：
//   1. 主线程启动 setTimeout
//   2. 超时时 worker.terminate() 强制杀掉
//   3. 下次执行前重建 Worker
// 这是浏览器沙箱中处理同步阻塞代码的唯一可靠方案。

let worker: Worker | null = null
let timeoutId: ReturnType<typeof setTimeout> | null = null
let isExecuting = false

const TIMEOUT_MS = 5000

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../../worker/interpreter.worker.ts', import.meta.url), {
      type: 'module',
    })
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

function clearTimeoutSafe() {
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
}

function postMessage(msg: WorkerRequest): void {
  if (!worker) return
  worker.postMessage(msg)
}

function onWorkerMessage(
  handler: (result: WorkerResult) => void
): void {
  const w = getWorker()
  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    handler(e.data)
  }
  w.onerror = (e: ErrorEvent) => {
    handler({
      type: 'error',
      errorMessage: `Worker 错误: ${e.message}`,
    })
  }
}

// ─── 运行 ──────────────────────────────────────────────────────────────

interface RunOptions {
  code: string
  stdin?: string
  timeout?: number
  onResult: (result: WorkerResult) => void
  onTimeout: () => void
  onProgress?: (partial: { stdout: string; stderr: string }) => void
}

function run(options: RunOptions): void {
   const { code, stdin = '', timeout = TIMEOUT_MS, onResult, onTimeout } = options
   const start = performance.now()

   // 清除之前可能残留的 timeout
   clearTimeoutSafe()

   if (isExecuting) {
     onResult({
       type: 'error',
       errorMessage: '上一次执行还未完成',
     })
     return
   }

  isExecuting = true

  // 用全新 Worker 执行，避免残留状态
  const w = createFreshWorker()

  // 超时由主线程管理：terminate() 是唯一可靠手段
  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()
    worker = null // 下次重建
    onTimeout()
  }, timeout)

  w.onmessage = (e: MessageEvent<WorkerResult>) => {
    isExecuting = false
    clearTimeoutSafe()
    const elapsed = Math.round(performance.now() - start)
    e.data.duration = elapsed
    onResult(e.data)
    // 正常完成后也重置 Worker（JSCPP 内部状态可能残留）
    w.terminate()
    worker = null
  }

  w.onerror = (e: ErrorEvent) => {
    isExecuting = false
    clearTimeoutSafe()
    w.terminate()
    worker = null
    onResult({
      type: 'error',
      errorMessage: `执行错误: ${e.message}`,
    })
  }

  const msg: WorkerRequest = {
    type: 'run',
    code,
    stdin,
  }

  w.postMessage(msg)
}

// ─── 中断 ──────────────────────────────────────────────────────────────

function interrupt(): void {
  if (!worker) return
  clearTimeoutSafe()
  isExecuting = false
  worker.terminate()
  worker = null
}

// ─── 检查状态 ──────────────────────────────────────────────────────────

function isRunning(): boolean {
  return isExecuting
}

export const sandbox = {
  run,
  interrupt,
  isRunning,
}
