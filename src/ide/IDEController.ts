import { useIDEStore } from '@/app/store'
import { sandbox } from '@/sandbox/sandbox'
import type { WorkerResult } from '@/sandbox/types'

/**
 * IDE 执行控制器
 *
 * 职责：
 * - 协调 store 与 sandbox（Worker）的通信
 * - 将 WorkerResult 映射到 store 状态变更
 * - 处理超时、错误、正常结果三种场景
 * - 管理调试会话（启动、步进、继续、停止）
 */
class IDEController {
  private debugActive = false

  // ─── 运行 ───────────────────────────────────────────────────────────

  run(): void {
    const store = useIDEStore.getState()
    const { code, stdin, status } = store

    if (sandbox.isRunning()) return

    // 停止调试
    if (this.debugActive) {
      this.debugActive = false
      store.setDebugMode('idle')
      store.setDebugState(null)
    }

    store.setStatus('running')
    store.clearResult()

    sandbox.run({
      code,
      stdin,
      timeout: 5000,
      onResult: (result) => this.handleResult(result),
      onTimeout: () => this.handleTimeout(),
    })
  }

  interrupt(): void {
    const store = useIDEStore.getState()
    if (!sandbox.isRunning()) return

    sandbox.interrupt()
    this.debugActive = false
    store.setStatus('error')
    store.setDebugMode('idle')
    store.setDebugState(null)
    store.setResult({
      stdout: '',
      stderr: '',
      exitCode: -1,
      duration: 0,
      errorMessage: '程序被手动终止',
    })
  }

  // ─── 调试 ───────────────────────────────────────────────────────────

  /** 启动调试 */
  debugStart(): void {
    const store = useIDEStore.getState()
    const { code, stdin, breakpoints, status } = store

    if (sandbox.isRunning() || this.debugActive) return

    store.setStatus('debugging')
    store.clearResult()
    this.debugActive = true
    store.setDebugMode('running')

    sandbox.debugStart({
      code,
      stdin,
      breakpoints,
      onResult: (result) => this.handleDebugResult(result),
      onTimeout: () => this.handleTimeout(),
    })
  }

  /** 单步执行 */
  debugStep(mode: 'next' | 'into' | 'out' = 'next'): void {
    const store = useIDEStore.getState()
    const { code, stdin, breakpoints, debugState } = store

    if (!debugState || !this.debugActive) return

    const currentLine = debugState.currentLine

    sandbox.debugStep({
      code,
      stdin,
      breakpoints,
      currentLine,
      debugMode: mode,
      onResult: (result) => this.handleDebugResult(result),
      onTimeout: () => this.handleTimeout(),
    })
  }

  /** 继续运行直到下一个断点 */
  debugContinue(): void {
    const store = useIDEStore.getState()
    const { code, stdin, breakpoints, debugState } = store

    if (!debugState || !this.debugActive) return

    const currentLine = debugState.currentLine

    sandbox.debugContinue({
      code,
      stdin,
      breakpoints,
      currentLine,
      onResult: (result) => this.handleDebugResult(result),
      onTimeout: () => this.handleTimeout(),
    })
  }

  /** 停止调试 */
  debugStop(): void {
    const store = useIDEStore.getState()
    if (sandbox.isRunning()) {
      sandbox.interrupt()
    }
    this.debugActive = false
    store.setStatus('idle')
    store.setDebugMode('idle')
    store.setDebugState(null)
  }

  isDebugging(): boolean {
    return this.debugActive
  }

  // ─── 内部处理 ───────────────────────────────────────────────────────

  private handleResult(result: WorkerResult): void {
    const store = useIDEStore.getState()

    if (result.type === 'timeout') {
      this.handleTimeout()
      return
    }

    if (result.type === 'error') {
      this.debugActive = false
      store.setStatus('error')
      store.setDebugMode('idle')
      store.setDebugState(null)
      store.setResult({
        stdout: '',
        stderr: '',
        exitCode: -1,
        duration: result.duration ?? 0,
        errorMessage: result.errorMessage ?? '未知错误',
      })
      return
    }

    // type === 'result'
    const hasError = !!(result.stderr || result.errorMessage)

    store.setResult({
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      exitCode: result.exitCode ?? 0,
      errorLine: result.errorLine,
      errorCol: result.errorCol,
      errorMessage: result.errorMessage,
      duration: result.duration ?? 0,
    })

    if (hasError) {
      store.setStatus('error')
    } else {
      store.setStatus('idle')
    }
  }

  private handleDebugResult(result: WorkerResult): void {
    const store = useIDEStore.getState()

    if (result.type === 'timeout') {
      this.handleTimeout()
      return
    }

    if (result.type === 'error') {
      this.debugActive = false
      store.setStatus('error')
      store.setDebugMode('idle')
      store.setDebugState(null)
      store.setResult({
        stdout: '',
        stderr: '',
        exitCode: -1,
        duration: result.duration ?? 0,
        errorMessage: result.errorMessage ?? '调试错误',
      })
      return
    }

    if (result.type === 'debug_paused' && result.debugState) {
      store.setDebugState({
        currentLine: result.debugState.currentLine,
        variables: result.debugState.variables,
        callStack: result.debugState.callStack.map(f => ({
          functionName: f.functionName,
          line: f.line,
          variables: [],
        })),
        stdout: result.debugState.stdout,
        stderr: '',
        paused: true,
        atBreakpoint: result.debugState.atBreakpoint,
      })
      store.setStatus('paused')
      store.setDebugMode('paused')

      // 更新终端输出
      if (result.debugState.stdout) {
        store.setResult({
          stdout: result.debugState.stdout,
          stderr: '',
          exitCode: 0,
          duration: result.duration ?? 0,
        })
      }
      return
    }

    if (result.type === 'debug_done') {
      this.debugActive = false
      store.setStatus('idle')
      store.setDebugMode('idle')
      store.setDebugState(null)
      store.setResult({
        stdout: result.stdout ?? '',
        stderr: '',
        exitCode: 0,
        duration: result.duration ?? 0,
      })
      return
    }

    // fallback: treat as error
    this.debugActive = false
    store.setStatus('error')
    store.setDebugMode('idle')
    store.setDebugState(null)
  }

  private handleTimeout(): void {
    const store = useIDEStore.getState()
    this.debugActive = false
    store.setStatus('timeout')
    store.setDebugMode('idle')
    store.setDebugState(null)
    store.setResult({
      stdout: '',
      stderr: '',
      exitCode: -1,
      duration: 5000,
      errorMessage: '执行超时（5秒），已强制终止。',
    })
  }
}

export const ideController = new IDEController()
