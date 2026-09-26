// Worker 通信协议
// 前端 → Worker
export interface WorkerRequest {
  type: 'run' | 'debug_start' | 'debug_step' | 'debug_continue' | 'debug_stop'
  code: string
  stdin: string
  breakpoints: number[]
  /** debug_step: 'next' | 'into' | 'out' */
  debugMode?: 'next' | 'into' | 'out'
  /** 当前执行到的行（用于 debug_continue 知道从哪继续） */
  currentLine?: number
}

// Worker → 前端
export interface WorkerResult {
  type: 'result' | 'timeout' | 'error' | 'debug_paused' | 'debug_done'
  stdout?: string
  stderr?: string
  exitCode?: number
  errorLine?: number
  errorCol?: number
  errorMessage?: string
  duration?: number
  // 调试状态
  debugState?: {
    currentLine: number
    variables: { name: string; value: unknown; type: string; line: number }[]
    callStack: { functionName: string; line: number }[]
    stdout: string
    atBreakpoint: boolean
  }
}
