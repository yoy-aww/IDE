import { EditorView } from '@/editor/EditorView'
import { Terminal } from '@/ide/Terminal'
import { ideController } from '@/ide/IDEController'
import { useIDEStore } from '@/app/store'

const SAMPLE_CODES = [
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
]

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
  } = useIDEStore()

  const handleRun = () => {
    ideController.run()
  }

  const handleInterrupt = () => {
    ideController.interrupt()
  }

  const loadSample = (sample: { code: string }) => {
    setCode(sample.code)
    setStdin('')
  }

  const isRunning = status === 'running'
  const isPaused = false // Phase 3+ 实现

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold">少儿编程 IDE</h1>
          <span className="text-xs text-gray-400">C++ 在线编程环境</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              status === 'idle'
                ? 'bg-gray-600 text-gray-300'
                : status === 'running'
                ? 'bg-yellow-600 text-yellow-100'
                : status === 'error'
                ? 'bg-red-600 text-red-100'
                : status === 'timeout'
                ? 'bg-orange-600 text-orange-100'
                : 'bg-gray-600 text-gray-300'
            }`}
          >
            {status === 'idle' && '就绪'}
            {status === 'running' && '运行中'}
            {status === 'error' && '错误'}
            {status === 'timeout' && '超时'}
          </span>

          {/* Run button */}
          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            <span>▶</span>
            <span>运行</span>
          </button>

          {/* Interrupt button */}
          <button
            onClick={handleInterrupt}
            disabled={!isRunning}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm rounded transition-colors"
          >
            <span>⏹</span>
            <span>终止</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor */}
        <div className="flex-1 flex flex-col">
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
            />
          </div>
        </div>

        {/* Side panel: Samples + Breakpoints */}
        <div className="w-64 border-l border-gray-700 bg-gray-850 overflow-auto flex flex-col">
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
        </div>
      </div>

      {/* Terminal with stdin support */}
      <div className="h-40 border-t border-gray-700 bg-gray-900 flex flex-col">
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
    </div>
  )
}

export default App
