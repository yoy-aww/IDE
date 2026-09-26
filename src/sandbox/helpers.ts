import type { Variable } from '@/app/store'

interface CallFrame {
  functionName: string
  line: number
  variables: Variable[]
}

interface WorkerResultDebug {
  type: 'debug_state' | 'debug_break'
  currentLine?: number
  variables?: Array<{ name: string; value: unknown; type: string; line: number }>
  callStack?: Array<{ functionName: string; line: number; variables: Array<{ name: string; value: unknown; type: string; line: number }> }>
  stdout?: string
  stderr?: string
  paused?: boolean
  atBreakpoint?: boolean
}

function extractVariables(data: Array<{ name: string; value: unknown; type: string; line: number }> | undefined): Variable[] {
  if (!data) return []
  return data as Variable[]
}

function extractCallFrames(data: WorkerResultDebug['callStack']): CallFrame[] {
  if (!data) return []
  return data.map((frame) => ({
    functionName: frame.functionName,
    line: frame.line,
    variables: extractVariables(frame.variables),
  }))
}

export { extractVariables, extractCallFrames }
export type { CallFrame }
