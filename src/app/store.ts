import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Variable {
  name: string
  value: unknown
  type: string
  line: number
}

export interface CallFrame {
  functionName: string
  line: number
  variables: Variable[]
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
  errorLine?: number
  errorCol?: number
  errorMessage?: string
  duration: number
}

export interface DebugState {
  currentLine: number
  variables: Variable[]
  callStack: CallFrame[]
  stdout: string
  stderr: string
  paused: boolean
  atBreakpoint: boolean
}

export type RunStatus = 'idle' | 'running' | 'debugging' | 'paused' | 'error' | 'timeout'

interface IDEStore {
  // 代码编辑
  code: string
  setCode: (code: string) => void

  // 输入 (stdin)
  stdin: string
  setStdin: (stdin: string) => void

  // 运行状态
  status: RunStatus
  setStatus: (status: RunStatus) => void

  result: RunResult | null
  setResult: (result: RunResult) => void

  clearResult: () => void

  // 断点
  breakpoints: number[]
  toggleBreakpoint: (line: number) => void

  // 光标位置
  cursorLine: number
  cursorCol: number
  setCursor: (line: number, col: number) => void

  // 调试状态（Phase 3+ 实现）
  debugState: DebugState | null
  setDebugState: (state: DebugState | null) => void

  debugMode: 'idle' | 'running' | 'paused'
  setDebugMode: (mode: 'idle' | 'running' | 'paused') => void
}

const DEFAULT_CODE = `#include <iostream>
using namespace std;

int main() {
    int a = 10;
    int b = 20;
    cout << a + b;
    return 0;
}`

export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({
      code: DEFAULT_CODE,
      setCode: (code) => set({ code }),

      stdin: '',
      setStdin: (stdin) => set({ stdin }),

      status: 'idle',
      setStatus: (status) => set({ status }),

      result: null,
      setResult: (result) => set({ result }),

      clearResult: () => set({ result: null, status: 'idle' }),

      breakpoints: [],
      toggleBreakpoint: (line) =>
        set((state) => ({
          breakpoints: state.breakpoints.includes(line)
            ? state.breakpoints.filter((l) => l !== line)
            : [...state.breakpoints, line].sort((a, b) => a - b),
        })),

      cursorLine: 1,
      cursorCol: 1,
      setCursor: (line, col) => set({ cursorLine: line, cursorCol: col }),

      debugState: null,
      setDebugState: (state: DebugState | null) => set({ debugState: state }),

      debugMode: 'idle',
      setDebugMode: (mode: 'idle' | 'running' | 'paused') => set({ debugMode: mode }),
    }),
    {
      name: 'kids-ide-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        code: state.code,
        stdin: state.stdin,
        breakpoints: state.breakpoints,
      }),
    }
  )
)
