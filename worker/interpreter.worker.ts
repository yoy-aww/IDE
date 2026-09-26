import JSCPP from 'JSCPP'
import type { WorkerRequest, WorkerResult } from '../src/sandbox/types'

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { code, stdin } = e.data
  handleRun(code, stdin)
}

function handleRun(code: string, stdin: string): void {
  let stdout = ''
  let stderr = ''

  const config = {
    stdio: {
      write: (s: string) => {
        stdout += s
      },
    },
    unsigned_overflow: 'error' as const,
  }

  try {
    const exitCode = JSCPP.run(code, stdin, config)

    postResult({
      type: 'result',
      stdout,
      stderr,
      exitCode,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const { errorLine, errorCol } = parseErrorLine(msg)

    postResult({
      type: 'result',
      stdout,
      stderr,
      exitCode: -1,
      errorLine,
      errorCol,
      errorMessage: msg,
    })
  }
}

/**
 * 解析 JSCPP 错误消息，提取行列号
 *
 * JSCPP 常见错误格式：
 *   "1:14 variable cout does not exist"          → line=1, col=14
 *   "3:1 cannot find library: vector"             → line=3, col=1
 *   "1:1: unexpected character 'x'"               → line=1, col=1
 *   "2:5: overflow of Infinity(unsigned int)"     → line=2, col=5
 *   "2:5: type int is not defined"                → line=2, col=5
 */
function parseErrorLine(msg: string): { errorLine?: number; errorCol?: number } {
  // 匹配 "行:列" 格式，如 "3:1" 或 "1:14"
  const match = msg.match(/^(\d+):(\d+)/)
  if (match) {
    return {
      errorLine: parseInt(match[1], 10),
      errorCol: parseInt(match[2], 10),
    }
  }

  // 备选：匹配 "line X" 格式
  const lineMatch = msg.match(/line\s+(\d+)/i)
  if (lineMatch) {
    return { errorLine: parseInt(lineMatch[1], 10) }
  }

  return {}
}

function postResult(result: WorkerResult): void {
  self.postMessage(result)
}
