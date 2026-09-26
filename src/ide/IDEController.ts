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
 */
class IDEController {
  run(): void {
    const store = useIDEStore.getState()
    const { code, stdin, status } = store

    if (sandbox.isRunning()) {
      return
    }

    store.setStatus('running')
    store.clearResult()

    sandbox.run({
      code,
      stdin,
      timeout: 5000,
      onResult: (result) => {
        this.handleResult(result)
      },
      onTimeout: () => {
        this.handleTimeout()
      },
    })
  }

  interrupt(): void {
    const store = useIDEStore.getState()
    if (!sandbox.isRunning()) return

    sandbox.interrupt()
    store.setStatus('error')
    store.setResult({
      stdout: '',
      stderr: '',
      exitCode: -1,
      duration: 0,
      errorMessage: '程序被手动终止',
    })
  }

  private handleResult(result: WorkerResult): void {
    const store = useIDEStore.getState()

    if (result.type === 'timeout') {
      this.handleTimeout()
      return
    }

    if (result.type === 'error') {
      store.setStatus('error')
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

  private handleTimeout(): void {
    const store = useIDEStore.getState()
    store.setStatus('timeout')
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
