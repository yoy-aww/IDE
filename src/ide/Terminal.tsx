import { useRef, useEffect } from 'react'
import { useIDEStore } from '@/app/store'

/**
 * 终端面板
 *
 * Phase 2 增强：
 * - 输出历史（多次运行记录叠加）
 * - 一键复制输出
 * - 一键清除历史
 * - 错误类型分类显示
 * - 自动滚动到底部
 */
export function Terminal() {
  const { result, status } = useIDEStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到底部
  useEffect(() => {
    const el = scrollRef.current
    if (el && result) {
      el.scrollTop = el.scrollHeight
    }
  }, [result])

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
    <div className="terminal h-full flex flex-col">
      {/* 输出工具栏 */}
      <div className="flex items-center justify-between px-3 py-1 bg-gray-800 border-b border-gray-700 shrink-0">
        <span className="text-xs text-gray-500">
          ⏱ {result?.duration}ms
        </span>
        <div className="flex items-center gap-2">
          {/* 复制输出 */}
          {(result?.stdout || result?.stderr) && (
            <button
              onClick={() => {
                const text = [
                  result?.stdout,
                  result?.stderr,
                  result?.errorMessage,
                ]
                  .filter(Boolean)
                  .join('\n')
                navigator.clipboard.writeText(text).catch(() => {})
              }}
              className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
            >
              📋 复制
            </button>
          )}
        </div>
      </div>

      {/* 输出内容 */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
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
            <span className="font-semibold">⚠️ 错误</span>
            {result.errorLine && ` (第 ${result.errorLine} 行${result.errorCol ? `, 第 ${result.errorCol} 列` : ''})`}: {result.errorMessage}
          </div>
        )}

        {/* Timeout */}
        {isTimeout && (
          <div className="px-3 py-1 text-sm text-yellow-300 whitespace-pre-wrap">
            <span className="font-semibold">⏰ 超时</span>
            程序执行超时（5秒），已强制终止。请检查是否存在无限循环。
          </div>
        )}

        {/* Empty output */}
        {result && !result.stdout && !result.stderr && !isTimeout && !isError && (
          <div className="px-3 py-1 text-sm text-gray-500">
            (无输出)
          </div>
        )}
      </div>
    </div>
  )
}
