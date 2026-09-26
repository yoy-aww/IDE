import { useRef, useEffect } from 'react'
import Editor, { type OnChange, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'

interface EditorViewProps {
  value: string
  onChange: (value: string) => void
  errorLine?: number
  errorCol?: number
  breakpoints?: number[]
  onToggleBreakpoint?: (line: number) => void
  currentDebugLine?: number
}

export function EditorView({
  value,
  onChange,
  errorLine,
  errorCol,
  breakpoints = [],
  onToggleBreakpoint,
  currentDebugLine,
}: EditorViewProps) {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const monacoRef = useRef<typeof monaco | null>(null)
  const toggleBreakpointRef = useRef(onToggleBreakpoint)
  toggleBreakpointRef.current = onToggleBreakpoint

  const handleMount: OnMount = (editor, monacoNs) => {
    editorRef.current = editor
    monacoRef.current = monacoNs

    // Toggle breakpoint on glyph margin click
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
  }

  const handleChange: OnChange = (val) => {
    onChange(val ?? '')
  }

  // Update decorations when breakpoints/error/debug line changes
  useEffect(() => {
    const editor = editorRef.current
    const monacoNs = monacoRef.current
    if (!editor || !monacoNs) return

    const deltas: monaco.editor.IModelDeltaDecoration[] = []

    // Breakpoints
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

    // Current debug line
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

    // Error line
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

    // Reveal error line
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
      loading={<div className="flex items-center justify-center h-full text-gray-400">编辑器加载中...</div>}
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
