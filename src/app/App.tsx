import { useEffect, useRef } from 'react'
import { EditorView } from '@/editor/EditorView'
import { Terminal } from '@/ide/Terminal'
import { ideController } from '@/ide/IDEController'
import { useIDEStore } from '@/app/store'

// ─── 示例代码库 ───────────────────────────────────────────────────────

interface Sample {
  name: string
  code: string
  stdin?: string
}

const SAMPLE_CODES: Sample[] = [
  {
    name: 'Hello World',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`,
  },
  {
    name: '变量练习',
    code: `#include <iostream>
using namespace std;

int main() {
    int a = 10;
    double b = 3.14;
    char c = 65;
    bool flag = true;

    cout << "整数: " << a << endl;
    cout << "小数: " << b << endl;
    cout << "字符(ASCII): " << (int)c << endl;
    cout << "布尔: " << flag << endl;
    return 0;
}`,
  },
  {
    name: '条件判断',
    code: `#include <iostream>
using namespace std;

int main() {
    int score = 85;

    if (score >= 90) {
        cout << "优秀" << endl;
    } else if (score >= 60) {
        cout << "及格" << endl;
    } else {
        cout << "不及格" << endl;
    }
    return 0;
}`,
  },
  {
    name: '循环',
    code: `#include <iostream>
using namespace std;

int main() {
    int sum = 0;

    for (int i = 1; i <= 10; i++) {
        sum += i;
    }

    cout << "1+2+...+10 = " << sum << endl;
    return 0;
}`,
  },
  {
    name: '数组',
    code: `#include <iostream>
using namespace std;

int main() {
    int arr[5] = {1, 2, 3, 4, 5};

    for (int i = 0; i < 5; i++) {
        cout << "arr[" << i << "] = " << arr[i] << endl;
    }
    return 0;
}`,
  },
  {
    name: '函数',
    code: `#include <iostream>
using namespace std;

int max(int a, int b) {
    if (a > b) return a;
    return b;
}

int main() {
    cout << "10和20的较大值: " << max(10, 20) << endl;
    cout << "100和50的较大值: " << max(100, 50) << endl;
    return 0;
}`,
  },
  {
    name: '指针',
    code: `#include <iostream>
using namespace std;

int main() {
    int a = 10;
    int* p = &a;
    cout << "*p = " << *p << endl;
    *p = 20;
    cout << "a = " << a << endl;
    cout << "&a = " << (int)&a << endl;
    cout << "p = " << (int)p << endl;
    return 0;
}`,
  },
  {
    name: 'switch',
    code: `#include <iostream>
using namespace std;

int main() {
    int day = 3;
    switch (day) {
        case 1: cout << "周一" << endl; break;
        case 2: cout << "周二" << endl; break;
        case 3: cout << "周三" << endl; break;
        default: cout << "其他" << endl;
    }
    return 0;
}`,
  },
  {
    name: '位运算',
    code: `#include <iostream>
using namespace std;

int main() {
    int a = 6;
    int b = 3;
    cout << "a & b = " << (a & b) << endl;
    cout << "a | b = " << (a | b) << endl;
    cout << "a ^ b = " << (a ^ b) << endl;
    cout << "~a = " << ~a << endl;
    cout << "a >> 1 = " << (a >> 1) << endl;
    cout << "a << 2 = " << (a << 2) << endl;
    return 0;
}`,
  },
  {
    name: 'while 循环',
    code: `#include <iostream>
using namespace std;

int main() {
    int n = 5;
    while (n > 0) {
        cout << n << " ";
        n--;
    }
    cout << "发射!" << endl;
    return 0;
}`,
  },
  {
    name: 'do-while 循环',
    code: `#include <iostream>
using namespace std;

int main() {
    int count = 0;
    do {
        cout << "次数: " << count << endl;
        count++;
    } while (count < 3);

    cout << "循环结束，共执行 " << count << " 次" << endl;
    return 0;
}`,
  },
  {
    name: '嵌套循环',
    code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 1; i <= 5; i++) {
        for (int j = 1; j <= i; j++) {
            cout << "*";
        }
        cout << endl;
    }
    return 0;
}`,
  },
  {
    name: '数学运算',
    code: `#include <iostream>
#include <cmath>
using namespace std;

int main() {
    cout << "sqrt(16) = " << sqrt(16.0) << endl;
    cout << "pow(2,3) = " << pow(2.0, 3.0) << endl;
    cout << "abs(-5) = " << abs(-5) << endl;
    cout << "max(10,20) = " << max(10, 20) << endl;
    return 0;
}`,
  },
  {
    name: '二维数组',
    code: `#include <iostream>
using namespace std;

int main() {
    int matrix[3][3] = {
        {1, 2, 3},
        {4, 5, 6},
        {7, 8, 9}
    };

    for (int i = 0; i < 3; i++) {
        for (int j = 0; j < 3; j++) {
            cout << matrix[i][j] << " ";
        }
        cout << endl;
    }
    return 0;
}`,
  },
  {
    name: '三元运算符',
    code: `#include <iostream>
using namespace std;

int main() {
    int a = 10, b = 20;
    cout << "较大值: " << (a > b ? a : b) << endl;
    cout << "较小值: " << (a < b ? a : b) << endl;

    int score = 75;
    cout << "等级: " << (score >= 90 ? "A" : score >= 60 ? "B" : "C") << endl;
    return 0;
}`,
  },
  {
    name: '输入输出',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "请输入两个整数:" << endl;
    int a, b;
    cin >> a >> b;

    cout << a << " + " << b << " = " << (a + b) << endl;
    cout << a << " * " << b << " = " << (a * b) << endl;
    return 0;
}`,
    stdin: '3 5',
  },
]

// ─── 状态栏组件 ───────────────────────────────────────────────────────

function StatusBar() {
  const { cursorLine, cursorCol, code, status, result, breakpoints } = useIDEStore()

  const lineCount = code.split('\n').length
  const hasError = status === 'error'
  const hasTimeout = status === 'timeout'

  return (
    <footer className="flex items-center justify-between px-3 py-0.5 bg-gray-800 border-t border-gray-700 text-xs text-gray-400 select-none">
      <div className="flex items-center gap-3">
        <span>行 {cursorLine}, 列 {cursorCol}</span>
        <span>{lineCount} 行</span>
        <span>C++</span>
      </div>
      <div className="flex items-center gap-3">
        {breakpoints.length > 0 && (
          <span className="text-red-400">
            ● {breakpoints.length} 个断点
          </span>
        )}
        {hasError && result?.errorLine && (
          <span className="text-red-400">
            ⚠ 第 {result.errorLine} 行
          </span>
        )}
        {hasTimeout && (
          <span className="text-yellow-400">⏰ 超时</span>
        )}
        <span className={
          status === 'running'
            ? 'text-yellow-400 animate-pulse'
            : status === 'error'
            ? 'text-red-400'
            : 'text-gray-400'
        }>
          {status === 'idle' && '● 就绪'}
          {status === 'running' && '● 运行中'}
          {status === 'error' && '● 错误'}
          {status === 'timeout' && '● 超时'}
        </span>
      </div>
    </footer>
  )
}

// ─── 主应用组件 ───────────────────────────────────────────────────────

function App() {
  const {
    code,
    setCode,
    stdin,
    setStdin,
    status,
    breakpoints,
    toggleBreakpoint,
    result,
    debugState,
    setCursor,
    clearResult,
  } = useIDEStore()

  const editorRef = useRef<unknown>(null)

  const handleRun = () => {
    ideController.run()
  }

  const handleInterrupt = () => {
    ideController.interrupt()
  }

  const handleClearOutput = () => {
    clearResult()
  }

  const loadSample = (sample: Sample) => {
    setCode(sample.code)
    setStdin(sample.stdin ?? '')
  }

  // 全局键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+Enter: 运行
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (!sandboxIsRunning()) {
          ideController.run()
        }
      }
      // Ctrl+C: 终止 (仅当正在运行)
      if (e.ctrlKey && e.key === 'c') {
        if (sandboxIsRunning()) {
          e.preventDefault()
          ideController.interrupt()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isRunning = status === 'running'

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">少儿编程 IDE</h1>
          <span className="text-xs text-gray-400">C++ 在线编程环境</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            title="Ctrl+Enter"
          >
            <span>▶</span>
            <span>运行</span>
          </button>

          {/* Interrupt button */}
          <button
            onClick={handleInterrupt}
            disabled={!isRunning}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
            title="Ctrl+C (运行时)"
          >
            <span>⏹</span>
            <span>终止</span>
          </button>

          {/* Clear output button */}
          {result && (
            <button
              onClick={handleClearOutput}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
              title="清除输出"
            >
              <span>🗑</span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <EditorView
              value={code}
              onChange={setCode}
              errorLine={result?.errorLine}
              errorCol={result?.errorCol}
              breakpoints={breakpoints}
              onToggleBreakpoint={toggleBreakpoint}
              currentDebugLine={
                debugState?.paused ? debugState.currentLine : undefined
              }
              onCursorChange={(line, col) => setCursor(line, col)}
            />
          </div>
        </div>

        {/* Side panel */}
        <div className="w-64 border-l border-gray-700 bg-gray-850 overflow-auto flex flex-col shrink-0">
          {/* Samples */}
          <div className="p-3 border-b border-gray-700">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">
              示例程序
            </h3>
            <div className="space-y-1">
              {SAMPLE_CODES.map((sample) => (
                <button
                  key={sample.name}
                  onClick={() => loadSample(sample)}
                  className="w-full text-left px-2 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>

          {/* Breakpoints list */}
          {breakpoints.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                断点 ({breakpoints.length})
              </h3>
              <div className="space-y-1">
                {breakpoints.map((line: number) => (
                  <button
                    key={line}
                    onClick={() => toggleBreakpoint(line)}
                    className="w-full text-left px-2 py-1 text-xs bg-red-900/30 hover:bg-red-900/50 rounded text-red-300 flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    <span>第 {line} 行</span>
                    <span className="ml-auto text-gray-500">✕</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Debug Variables (Phase 3+) */}
          {debugState && debugState.variables && debugState.variables.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                变量
              </h3>
              <div className="space-y-1">
                {debugState.variables.map((v: { name: string; value: unknown; type: string; line: number }, i: number) => (
                  <div
                    key={i}
                    className="text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded"
                  >
                    <span className="text-blue-300">{v.name}</span>
                    <span className="text-gray-400"> = </span>
                    <span className="text-green-300">{String(v.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shortcuts hint */}
          <div className="px-3 py-2 mt-auto">
            <h3 className="text-xs font-semibold text-gray-400 mb-1">
              快捷键
            </h3>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>Ctrl+Enter: 运行</div>
              <div>Ctrl+C: 终止</div>
              <div>点击行号: 设置断点</div>
            </div>
          </div>
        </div>
      </div>

      {/* Terminal with stdin support */}
      <div className="h-40 border-t border-gray-700 bg-gray-900 flex flex-col shrink-0">
        {/* Stdin input */}
        {stdin !== '' && (
          <div className="flex items-start gap-2 px-3 py-1 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400 mt-1 shrink-0">stdin:</span>
            <input
              type="text"
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              placeholder="输入用户输入，多个值用空格分隔"
              className="flex-1 bg-transparent text-xs text-gray-200 outline-none"
            />
          </div>
        )}
        <div className="flex-1 overflow-auto">
          <Terminal />
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}

// 获取 sandbox 运行状态（从 IDEController 代理）
function sandboxIsRunning(): boolean {
  return useIDEStore.getState().status === 'running'
}

export default App
