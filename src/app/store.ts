import { create } from 'zustand'

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
  code: string
  setCode: (code: string) => void

  status: RunStatus
  setStatus: (status: RunStatus) => void

  result: RunResult | null
  setResult: (result: RunResult) => void

  debugState: DebugState | null
  setDebugState: (state: DebugState) => void

  breakpoints: number[]
  toggleBreakpoint: (line: number) => void

  debugMode: 'idle' | 'running' | 'paused'
  setDebugMode: (mode: 'idle' | 'running' | 'paused') => void

  clearResult: () => void
}

export const useIDEStore = create<IDEStore>((set) => ({
  code: `#include <iostream>
using namespace std;

int main() {
    int a = 10;
    int b = 20;
    cout << a + b;
    return 0;
}`,

  setCode: (code) => set({ code }),

  status: 'idle',
  setStatus: (status) => set({ status }),

  result: null,
  setResult: (result) => set({ result }),

  debugState: null,
  setDebugState: (state) => set({ debugState: state }),

  breakpoints: [],
  toggleBreakpoint: (line) =>
    set((state) => ({
      breakpoints: state.breakpoints.includes(line)
        ? state.breakpoints.filter((l) => l !== line)
        : [...state.breakpoints, line].sort((a, b) => a - b),
    })),

  debugMode: 'idle',
  setDebugMode: (mode) => set({ debugMode: mode }),

  clearResult: () => set({ result: null, status: 'idle' }),
}))
