import { run } from '../src/interpreter'
import type { WorkerRequest, WorkerResult } from '../src/sandbox/types'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { code, stdin } = e.data
  handleRun(code, stdin)
}

function handleRun(code: string, stdin: string): void {
  const result = run(code, stdin)

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

function postResult(result: WorkerResult): void {
  self.postMessage(result)
}
