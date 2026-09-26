export interface WorkerRequest {
  type: 'run' | 'debug_start' | 'debug_step' | 'debug_continue' | 'debug_interrupt'
  code?: string
  breakpoints?: number[]
  stepMode?: 'next' | 'over' | 'into' | 'out'
}

export interface WorkerResult {
  type: 'result' | 'debug_state' | 'debug_break' | 'timeout' | 'error'
  stdout?: string
  stderr?: string
  exitCode?: number
  errorLine?: number
  errorCol?: number
  errorMessage?: string
  duration?: number
  currentLine?: number
  variables?: Array<{ name: string; value: unknown; type: string; line: number }>
  callStack?: Array<{ functionName: string; line: number; variables: unknown[] }>
  paused?: boolean
  atBreakpoint?: boolean
  message?: string
}
