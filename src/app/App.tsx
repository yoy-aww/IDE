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
  {
    name: '斐波那契数列',
    code: `#include <iostream>
using namespace std;

// 递归实现斐波那契数列
int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "斐波那契数列:" << endl;
    for (int i = 0; i <= 10; i++) {
        cout << fibonacci(i) << " ";
    }
    cout << endl;
    return 0;
}`,
  },
  {
    name: '猜数字游戏',
    code: `#include <iostream>
using namespace std;

int main() {
    // 简单猜数字：固定答案为 7
    int answer = 7;
    int guess = 0;
    int attempts = 0;

    cout << "猜数字游戏! 我想了个 1-20 之间的数" << endl;

    while (guess != answer) {
        attempts++;
        cin >> guess;
        if (guess < answer) {
            cout << "太小了! 再试一次" << endl;
        } else if (guess > answer) {
            cout << "太大了! 再试一次" << endl;
        }
    }

    cout << "恭喜你! 猜对了!" << endl;
    cout << "一共猜了 " << attempts << " 次" << endl;
    return 0;
}`,
    stdin: '1 15 7',
  },
  {
    name: '闰年判断',
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "判断哪些年份是闰年:" << endl;

    for (int year = 1900; year <= 2100; year += 100) {
        // 闰年规则：能被4整除但不能被100整除，或者能被400整除
        if ((year % 4 == 0 && year % 100 != 0) || (year % 400 == 0)) {
            cout << year << " 是闰年" << endl;
        } else {
            cout << year << " 不是闰年" << endl;
        }
    }
    return 0;
}`,
  },
  {
    name: '图形打印',
    code: `#include <iostream>
using namespace std;

int main() {
    // 打印三角形
    cout << "直角三角形:" << endl;
    for (int i = 1; i <= 5; i++) {
        for (int j = 1; j <= i; j++) {
            cout << "*";
        }
        cout << endl;
    }

    cout << endl << "等腰三角形:" << endl;
    for (int i = 1; i <= 5; i++) {
        // 打印空格
        for (int j = 1; j <= (5 - i); j++) {
            cout << " ";
        }
        // 打印星号
        for (int k = 1; k <= (2 * i - 1); k++) {
            cout << "*";
        }
        cout << endl;
    }

    return 0;
}`,
  },
  {
    name: '数字金字塔',
    code: `#include <iostream>
using namespace std;

int main() {
    int n = 5;

    // 上半部分（金字塔）
    for (int i = 1; i <= n; i++) {
        for (int j = 1; j <= (n - i); j++) {
            cout << "  ";
        }
        for (int k = 1; k <= (2 * i - 1); k++) {
            cout << i << " ";
        }
        cout << endl;
    }

    // 下半部分（倒金字塔）
    for (int i = n - 1; i >= 1; i--) {
        for (int j = 1; j <= (n - i); j++) {
            cout << "  ";
        }
        for (int k = 1; k <= (2 * i - 1); k++) {
            cout << i << " ";
        }
        cout << endl;
    }

    return 0;
}`,
  },
  {
    name: '简易计算器',
    code: `#include <iostream>
using namespace std;

// 加减乘除函数
double calc(double a, double b, char op) {
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/':
            if (b == 0) {
                cout << "错误：不能除以 0!" << endl;
                return 0;
            }
            return a / b;
    }
    return 0;
}

int main() {
    double a, b;
    char op;

    cin >> a >> op >> b;

    cout << a << " " << op << " " << b << " = " << calc(a, b, op) << endl;
    return 0;
}`,
    stdin: '8 / 2',
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
    debugMode,
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
      // F5: 启动调试 / 继续
      if (e.key === 'F5') {
        e.preventDefault()
        const store = useIDEStore.getState()
        if (store.debugMode === 'idle') {
          ideController.debugStart()
        } else if (store.debugMode === 'paused') {
          ideController.debugContinue()
        }
        return
      }
      // F9: 继续到下一个断点
      if (e.key === 'F9') {
        e.preventDefault()
        const store = useIDEStore.getState()
        if (store.debugMode === 'paused') {
          ideController.debugContinue()
        }
        return
      }
      // F10: 单步执行
      if (e.key === 'F10') {
        e.preventDefault()
        const store = useIDEStore.getState()
        if (store.debugMode === 'paused') {
          ideController.debugStep('next')
        }
        return
      }
      // Ctrl+Enter: 运行
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        if (useIDEStore.getState().status !== 'running' && useIDEStore.getState().debugMode === 'idle') {
          ideController.run()
        }
      }
      // Ctrl+C: 终止
      if (e.ctrlKey && e.key === 'c') {
        const store = useIDEStore.getState()
        if (store.debugMode !== 'idle') {
          e.preventDefault()
          ideController.debugStop()
        } else if (store.status === 'running') {
          e.preventDefault()
          ideController.interrupt()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const isRunning = status === 'running'
  const isDebugging = debugMode !== 'idle'

  const handleDebugStart = () => {
    ideController.debugStart()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">少儿编程 IDE</h1>
          <span className="text-xs text-gray-400">C++ 在线编程环境</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Debug toolbar — visible when debugging */}
          {isDebugging && (
            <>
              <button
                onClick={() => ideController.debugContinue()}
                disabled={!debugState?.paused}
                className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                title="F9: 继续到下一个断点"
              >
                <span>▶</span>
                <span>继续</span>
              </button>

              <button
                onClick={() => ideController.debugStep('next')}
                disabled={!debugState?.paused}
                className="flex items-center gap-1 px-3 py-1.5 bg-yellow-700 hover:bg-yellow-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                title="F10: 下一步 (不进入函数)"
              >
                <span>⏭</span>
                <span>步进</span>
              </button>

              <button
                onClick={() => ideController.debugStop()}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                title="停止调试"
              >
                <span>⏹</span>
                <span>停止</span>
              </button>

              <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-300 rounded">
                调试中
              </span>
            </>
          )}

          {/* Normal toolbar */}
          {!isDebugging && (
            <>
              <button
                onClick={handleDebugStart}
                disabled={isRunning}
                className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                title="F5: 开始调试"
              >
                <span>🔍</span>
                <span>调试</span>
              </button>

              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                title="Ctrl+Enter: 运行"
              >
                <span>▶</span>
                <span>运行</span>
              </button>

              <button
                onClick={handleInterrupt}
                disabled={!isRunning}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
                title="Ctrl+C (运行时)"
              >
                <span>⏹</span>
                <span>终止</span>
              </button>

              {result && (
                <button
                  onClick={handleClearOutput}
                  className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors"
                  title="清除输出"
                >
                  <span>🗑</span>
                </button>
              )}
            </>
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

          {/* Debug Variables */}
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

          {/* Call Stack */}
          {debugState && debugState.callStack && debugState.callStack.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">
                调用栈
              </h3>
              <div className="space-y-1">
                {debugState.callStack.map((f, i) => (
                  <div
                    key={i}
                    className="text-xs text-gray-300 bg-gray-700/50 px-2 py-1 rounded"
                  >
                    <span className="text-yellow-300">{f.functionName}</span>
                    <span className="text-gray-400"> · 第 </span>
                    <span className="text-green-300">{f.line}</span>
                    <span className="text-gray-400"> 行</span>
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
