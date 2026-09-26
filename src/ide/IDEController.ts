import { useIDEStore } from '@/app/store'
import type { WorkerRequest, WorkerResult } from '@/sandbox/types'

export class IDEController {
  private worker: Worker | null = null

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    this.worker = new Worker(
      new URL('../../worker/interpreter.worker.ts', import.meta.url),
      { type: 'module' }
    )

    this.worker.onmessage = (e: MessageEvent<WorkerResult>) => {
      this.handleWorkerMessage(e.data)
    }

    this.worker.onerror = (e: ErrorEvent) => {
      useIDEStore.getState().setStatus('error')
      useIDEStore.getState().setResult({
        stdout: '',
        stderr: `Worker 错误: ${e.message}`,
        exitCode: -1,
        duration: 0,
        errorMessage: e.message,
      })
    }
  }

  private postMessage(msg: WorkerRequest) {
    this.worker?.postMessage(msg)
  }

  private handleWorkerMessage(result: WorkerResult) {
    const store = useIDEStore.getState()

    switch (result.type) {
      case 'result':
        store.setResult({
          stdout: result.stdout || '',
          stderr: result.stderr || '',
          exitCode: result.exitCode ?? 0,
          errorLine: result.errorLine,
          errorCol: result.errorCol,
          errorMessage: result.errorMessage,
          duration: result.duration ?? 0,
        })
        store.setStatus(
          (result.stderr || result.errorMessage) ? 'error' : 'idle'
        )
        break

      case 'timeout':
        store.setResult({
          stdout: '',
          stderr: '',
          exitCode: -1,
          duration: 5000,
          errorMessage: '执行超时',
        })
        store.setStatus('timeout')
        break

      case 'error':
        store.setStatus('error')
        store.setResult({
          stdout: '',
          stderr: result.message || '未知错误',
          exitCode: -1,
          duration: 0,
          errorMessage: result.message,
        })
        break

      case 'debug_state':
      case 'debug_break': {
        const state = result as unknown as {
          currentLine?: number
          variables?: Array<{ name: string; value: unknown; type: string; line: number }>
          callStack?: Array<{ functionName: string; line: number; variables: Array<{ name: string; value: unknown; type: string; line: number }> }>
          stdout?: string
          stderr?: string
          paused?: boolean
          atBreakpoint?: boolean
        }

        store.setDebugState({
          currentLine: state.currentLine || 0,
          variables: (state.variables || []) as any,
          callStack: (state.callStack || []) as any,
          stdout: state.stdout || '',
          stderr: state.stderr || '',
          paused: state.paused || false,
          atBreakpoint: state.atBreakpoint || false,
        })
        store.setDebugMode('paused')
        break
      }
    }
  }

  async run(): Promise<void> {
    const store = useIDEStore.getState()
    store.setStatus('running')
    store.clearResult()
    store.setDebugMode('idle')

    this.postMessage({
      type: 'run',
      code: store.code,
    })
  }

  debugRun(): void {
    const store = useIDEStore.getState()
    store.setDebugMode('running')
    store.setStatus('debugging')
    store.clearResult()

    this.postMessage({
      type: 'debug_start',
      code: store.code,
      breakpoints: store.breakpoints,
    })
  }

  debugStep(mode: 'next' | 'over' | 'into' | 'out' = 'next'): void {
    this.postMessage({
      type: 'debug_step',
      stepMode: mode,
    })
  }

  debugContinue(): void {
    useIDEStore.getState().setDebugMode('running')
    this.postMessage({ type: 'debug_continue' })
  }

  debugInterrupt(): void {
    this.postMessage({ type: 'debug_interrupt' })
  }

  destroy(): void {
    this.worker?.terminate()
    this.worker = null
  }
}

// Singleton
export const ideController = new IDEController()
