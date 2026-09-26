import { useRef, useEffect, useCallback } from 'react'
import Editor, { type OnChange, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// 使用本地安装的 monaco-editor 包，不依赖 CDN
// 解决少儿教室离线场景下 Monaco 字体/资源加载失败的问题
loader.config({ monaco })

interface EditorViewProps {
  value: string
  onChange: (value: string) => void
  errorLine?: number
  errorCol?: number
  breakpoints?: number[]
  onToggleBreakpoint?: (line: number) => void
  currentDebugLine?: number
  onCursorChange?: (line: number, col: number) => void
  onEditorMount?: (editor: monaco.editor.IStandaloneCodeEditor) => void
}

export function EditorView({
  value,
  onChange,
  errorLine,
  errorCol,
  breakpoints = [],
  onToggleBreakpoint,
  currentDebugLine,
  onCursorChange,
  onEditorMount,
}: EditorViewProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const toggleBreakpointRef = useRef(onToggleBreakpoint)
  const cursorChangeRef = useRef(onCursorChange)
  const editorMountRef = useRef(onEditorMount)

  toggleBreakpointRef.current = onToggleBreakpoint
  cursorChangeRef.current = onCursorChange
  editorMountRef.current = onEditorMount

  const handleMount: OnMount = (editor, monacoNs) => {
    editorRef.current = editor
    monacoRef.current = monacoNs

    // 断点：点击行号左侧 gutter 切换
    editor.onMouseDown((e) => {
      if (
        e.target &&
        e.target.type === monacoNs.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
        e.target.position &&
        toggleBreakpointRef.current
      ) {
        toggleBreakpointRef.current(e.target.position.lineNumber)
      }
    })

    // 光标位置变化
    editor.onDidChangeCursorPosition((e) => {
      cursorChangeRef.current?.(e.position.lineNumber, e.position.column)
    })

    // 通知外部编辑器已就绪
    editorMountRef.current?.(editor)
  }

  const handleChange: OnChange = (val) => {
    onChange(val ?? '')
  }

  // 更新装饰（断点、错误行、调试行）
  useEffect(() => {
    const editor = editorRef.current
    const monacoNs = monacoRef.current
    if (!editor || !monacoNs) return

    const deltas: monaco.editor.IModelDeltaDecoration[] = []

    // 断点标记
    breakpoints.forEach((line) => {
      deltas.push({
        range: new monacoNs.Range(line, 1, line, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'breakpoint-marker',
          glyphMarginHoverMessage: { value: '断点 (点击移除)' },
        },
      })
    })

    // 调试当前行
    if (currentDebugLine) {
      deltas.push({
        range: new monacoNs.Range(currentDebugLine, 1, currentDebugLine, 1),
        options: {
          isWholeLine: true,
          className: 'debug-current-line',
          glyphMarginClassName: 'debug-arrow',
          glyphMarginHoverMessage: { value: '当前执行行' },
        },
      })
    }

    // 错误行高亮
    if (errorLine) {
      const endCol = errorCol || Infinity
      deltas.push({
        range: new monacoNs.Range(errorLine, 1, errorLine, endCol),
        options: {
          isWholeLine: false,
          className: 'error-line',
          glyphMarginClassName: 'error-marker',
          glyphMarginHoverMessage: { value: '语法/运行时错误' },
        },
      })
    }

    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection()
    }
    decorationsRef.current.set(deltas)

    // 自动滚动到错误行
    if (errorLine) {
      editor.revealLineInCenter(errorLine)
    }
  }, [errorLine, errorCol, breakpoints, currentDebugLine])

  return (
    <Editor
      defaultLanguage="cpp"
      value={value}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={EDITOR_OPTIONS}
      loading={
        <div className="flex items-center justify-center h-full text-gray-400">
          编辑器加载中...
        </div>
      }
    />
  )
}

const EDITOR_OPTIONS: monaco.editor.IEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 14,
  lineHeight: 20,
  lineNumbers: 'on',
  renderLineHighlight: 'line',
  scrollBeyondLastLine: false,
  bracketPairColorization: { enabled: true },
  glyphMargin: true,
  folding: true,
  scrollBeyondLastColumn: 0,
  padding: { top: 12, bottom: 12 },
  renderValidationDecorations: 'on',
  smoothScrolling: true,
  cursorBlinking: 'smooth',
  cursorSmoothCaretAnimation: 'on',
  guides: {
    bracketPairs: true,
    indentation: true,
  },
}
