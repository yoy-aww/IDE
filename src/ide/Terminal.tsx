import { useIDEStore } from '@/app/store'

export function Terminal() {
  const { result, status } = useIDEStore()

  if (!result && status === 'idle') {
    return (
      <div className="terminal flex items-center justify-center h-full">
        <span className="text-gray-400 text-sm">运行程序后输出将显示在这里</span>
      </div>
    )
  }

  if (status === 'running') {
    return (
      <div className="terminal flex items-center justify-center h-full">
        <span className="text-green-400 animate-pulse">⏳ 正在执行...</span>
      </div>
    )
  }

  const isTimeout = status === 'timeout'
  const isError = status === 'error' || (result && result.stderr)

  return (
    <div className="terminal h-full overflow-auto">
      {/* Duration */}
      <div className="px-3 py-1 text-xs text-gray-500 border-b border-gray-700">
        ⏱ {result?.duration}ms
      </div>

      {/* Stdout */}
      {result?.stdout && (
        <div className="px-3 py-1 text-sm text-green-300 whitespace-pre-wrap">
          {result.stdout}
        </div>
      )}

      {/* Stderr */}
      {result?.stderr && (
        <div className="px-3 py-1 text-sm text-red-400 whitespace-pre-wrap">
          {result.stderr}
        </div>
      )}

      {/* Error message */}
      {isError && result?.errorMessage && (
        <div className="px-3 py-1 text-sm text-red-300 whitespace-pre-wrap">
          ⚠️ 第 {result.errorLine ?? '?'} 行: {result.errorMessage}
        </div>
      )}

      {/* Timeout */}
      {isTimeout && (
        <div className="px-3 py-1 text-sm text-yellow-300 whitespace-pre-wrap">
          ⏰ 程序执行超时（5秒），已自动终止。请检查是否存在无限循环。
        </div>
      )}

      {/* Empty output */}
      {result && !result.stdout && !result.stderr && !isTimeout && !isError && (
        <div className="px-3 py-1 text-sm text-gray-500">
          (无输出)
        </div>
      )}
    </div>
  )
}
