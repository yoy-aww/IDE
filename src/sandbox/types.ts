// Worker 通信协议
// 前端 → Worker
export interface WorkerRequest {
  type: 'run'
  code: string
  stdin: string
}

// Worker → 前端
export interface WorkerResult {
  type: 'result' | 'timeout' | 'error'
  stdout?: string
  stderr?: string
  exitCode?: number
  errorLine?: number
  errorCol?: number
  errorMessage?: string
  duration?: number
}

// 运行配置
export interface RunConfig {
  timeout?: number
}
