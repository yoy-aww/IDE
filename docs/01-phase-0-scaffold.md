# Phase 0: 项目脚手架

> 搭建能跑通"写代码 → 点运行 → 看到输出"的最短链路。

## 目标

Phase 0 不是做完整 IDE，而是验证架构可行：

```
用户写 C++ 代码 → Monaco 编辑器 → Worker 里 JSCPP 执行 → 输出显示在终端
```

## 做了什么

| 模块 | 文件 | 作用 |
|---|---|---|
| 应用入口 | `src/main.tsx` | React 挂载 |
| 状态管理 | `src/app/store.ts` | Zustand store，管理代码/状态/结果/断点/调试 |
| 主界面 | `src/app/App.tsx` | 顶栏按钮 + 编辑器 + 侧栏 + 终端 |
| 编辑器 | `src/editor/EditorView.tsx` | Monaco Editor 封装，断点/错误/调试高亮 |
| 控制器 | `src/ide/IDEController.ts` | Worker 通信，消息分发到 store |
| 终端 | `src/ide/Terminal.tsx` | 输出显示，状态提示 |
| 沙箱类型 | `src/sandbox/types.ts` | Worker 通信协议定义 |
| 解释器 Worker | `worker/interpreter.worker.ts` | JSCPP 执行，超时控制 |
| JSCPP 类型 | `src/types/jscpp.d.ts` | 手写类型声明（JSCPP 是 CJS 无类型） |

## 关键决策

### 1. JSCPP 的 CJS → ESM 互操作

JSCPP 是纯 CJS 包（`module.exports`），Vite 默认不处理 CJS 依赖的 Worker 导入。

**解决方案：**

`vite.config.ts` 里加了 `optimizeDeps.include`，让 Vite 预构建时把 CJS 转成 ESM：

```ts
optimizeDeps: {
  include: ['JSCPP'],
},
```

同时手写 `src/types/jscpp.d.ts` 提供类型声明：

```ts
declare module 'JSCPP' {
  interface JSCPPConfig {
    stdio?: { write?: (s: string) => void }
    unsigned_overflow?: 'error' | 'warn' | 'ignore'
  }
  const JSCPP: { run(code: string, input?: string, config?: JSCPPConfig): number }
  export default JSCPP
}
```

**教训：** 不要用 `import { createRequire } from 'module'` 在 Worker 里——`module` 是 Node 内置模块，浏览器端不存在。

### 2. Worker 路径解析

`IDEController.ts` 在 `src/ide/` 目录，Worker 在 `worker/` 根目录。路径差两级：

```ts
// ❌ 错误：只回了一级
new URL('../worker/interpreter.worker.ts', import.meta.url)

// ✅ 正确：src/ide → src → 根目录
new URL('../../worker/interpreter.worker.ts', import.meta.url)
```

Vite 构建时会把 Worker 代码单独打包成 `dist/assets/interpreter.worker-*.js`，路径由 Vite 自动解析。

### 3. Monaco Editor 集成

用 `@monaco-editor/react` 而不是直接用 `monaco-editor`——前者是 React 封装，自动处理生命周期、懒加载。

**关键配置点：**

```ts
const EDITOR_OPTIONS: monaco.editor.IEditorConstructionOptions = {
  glyphMargin: true,      // 必须有，否则断点点击不生效
  minimap: { enabled: false },  // 少儿场景不需要 minimap
  bracketPairColorization: { enabled: true },
  // ... 见 EditorView.tsx
}
```

**断点点击实现：**

Monaco 的 `onMouseDown` 事件里检查 `GUTTER_GLYPH_MARGIN` 类型，点击行号左侧即可切换断点：

```ts
editor.onMouseDown((e) => {
  if (
    e.target?.type === monacoNs.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
    e.target.position
  ) {
    onToggleBreakpoint(e.target.position.lineNumber)
  }
})
```

**装饰器动态更新：**

用 `createDecorationsCollection` 管理断点/错误行/调试行的视觉标记。`useEffect` 监听状态变化后调 `decorations.set(deltas)` 重新设置。

```ts
// 每次 breakpoints / errorLine / currentDebugLine 变化时
decorationsRef.current.set([
  { range: new monacoNs.Range(line, 1, line, 1),
    options: { glyphMarginClassName: 'breakpoint-marker' } },
  // ... 错误行、调试行同理
])
```

### 4. Worker 通信协议

定义了统一的 `WorkerRequest` / `WorkerResult` 类型，前后端解耦：

```
前端 → Worker:
  { type: 'run', code: string, breakpoints: number[] }
  { type: 'debug_start', code: string, breakpoints: number[] }
  { type: 'debug_step', stepMode: 'next'|'over'|'into'|'out' }
  { type: 'debug_continue' }
  { type: 'debug_interrupt' }

Worker → 前端:
  { type: 'result', stdout, stderr, exitCode, duration, errorLine? }
  { type: 'timeout' }
  { type: 'error', message }
  { type: 'debug_state', currentLine, variables, callStack, paused }
  { type: 'debug_break', currentLine, variables, callStack, atBreakpoint }
```

这个协议是 Phase 1-4 的基础——自研解释器只要保持协议不变，前端完全不用改。

### 5. 超时控制

Worker 内部 `setTimeout` 实现 5 秒超时：

```ts
const timeoutId = setTimeout(() => {
  postResult({ type: 'timeout' })
}, 5000)

try {
  exitCode = JSCPP.run(code, '', config)  // 同步阻塞
  clearTimeout(timeoutId)
} catch (err) {
  clearTimeout(timeoutId)
  // 错误处理
}
```

**注意：** JSCPP 的 `run()` 是同步阻塞的。如果代码无限循环，Worker 会被卡住，`setTimeout` 回调也不会执行（JS 单线程）。超时只是"尽力而为"——如果代码在 Worker 里死循环，只有 `worker.terminate()` 能强制终止。Phase 1 会改进这个机制。

### 6. Zustand Store 设计

`store.ts` 是整个 IDE 的单一状态源：

```ts
interface IDEStore {
  // 编辑器状态
  code: string
  setCode: (code: string) => void

  // 运行状态
  status: RunStatus  // 'idle'|'running'|'debugging'|'paused'|'error'|'timeout'
  result: RunResult | null

  // 调试状态
  debugState: DebugState | null  // 变量、调用栈、当前行
  debugMode: 'idle'|'running'|'paused'

  // 断点
  breakpoints: number[]
  toggleBreakpoint: (line: number) => void
}
```

**为什么不用 Redux？** Zustand 没有 Provider、没有 action/reducer boilerplate，适合这种轻量级应用。`useIDEStore()` 一行代码搞定。

### 7. 示例代码选择

选了 9 个示例，全部在 JSCPP 支持范围内：

| 示例 | 覆盖语法 |
|---|---|
| Hello World | `cout`, `endl` |
| 变量练习 | `int`, `double`, `char`, `bool`, 强制转换 |
| 条件判断 | `if`/`else if`/`else` |
| 循环 | `for` 循环, `+=` |
| 数组 | 数组初始化, 下标访问 |
| 函数 | 函数定义, 参数传递 |
| 指针 | `&`, `*`, 指针赋值 |
| switch | `switch`/`case`/`break`/`default` |
| 位运算 | `&`, `|`, `^`, `~`, `>>`, `<<` |

## JSCPP 支持矩阵（已验证）

| 特性 | 支持 | 备注 |
|---|---|---|
| int/double/float/char/bool | ✅ | |
| 基本运算符 | ✅ | `+ - * / % == != < > <= >=` |
| 逻辑运算 | ✅ | `&& \|\| !` |
| 位运算 | ✅ | `& \| ^ ~ << >>` |
| 三元运算符 | ✅ | `cond ? a : b` |
| `if`/`else` | ✅ | |
| `for` 循环 | ✅ | 含初始化/条件/递增 |
| `while` 循环 | ✅ | |
| `do-while` 循环 | ✅ | |
| `switch`/`case` | ✅ | |
| `break`/`continue` | ✅ | |
| `return` | ✅ | |
| 数组 | ✅ | `int a[5]`, 下标访问 |
| 二维数组 | ✅ | `int a[2][3]` |
| 函数定义 | ✅ | 含参数传递 |
| 指针 | ✅ | `int* p = &a`, `*p`, `&a` |
| `cout <<` | ✅ | 含字符串字面量、变量、表达式 |
| `endl` | ✅ | |
| `cmath` | ✅ | `sqrt`, `pow`, `abs` 等 |
| `cstdlib` | ✅ | `rand`, `abs` |
| `vector` | ❌ | `#include <vector>` 报 "cannot find library" |
| `string` | ❌ | `#include <string>` 报 "cannot find library" |
| `struct` | ❌ | `struct X {}` 报 "type struct is not defined" |
| `class` | ❌ | 同上 |
| `cin >>` | ❌ | 输入功能不支持 |
| `auto` | ❌ | 类型推导不支持 |
| 模板 | ❌ | `template <typename T>` 不支持 |
| 字符串函数 | ❌ | `strcpy`, `strlen`, `strcmp` 不可用 |
| 字符数组 | ⚠️ | `char s[] = "hello"` 可以声明，但 `cout << s` 需要手动转换 |
| `string` 类 | ❌ | `string s = "hello"` 报 "type string is not defined" |
| `std::vector` | ❌ | 完全不支持 |

## 验证记录

| 测试项 | 结果 | 命令 |
|---|---|---|
| TypeScript 编译 | ✅ 通过 | `npx tsc -b --noEmit` |
| Vite 构建 | ✅ 通过 | `vite build` |
| 开发服务器 | ✅ 响应 | `curl localhost:5174` 返回 HTML |
| Hello World | ✅ `Hello, World!` | `JSCPP.run(code)` |
| 算术表达式 | ✅ `30` | `cout << 10 + 20` |
| 数组遍历 | ✅ `1 2 3 4 5` | `for` 循环打印数组 |
| 函数调用 | ✅ `20\n100` | `max(10,20)` + `max(100,50)` |
| 指针操作 | ✅ `10 20` | `*p` 读写 |
| 位运算 | ✅ `2 7 5 -7 3 12` | `& \| ^ ~ >> <<` |
| switch | ✅ `two` | `case 2: cout << "two"` |
| 语法错误 | ✅ 错误消息 | `cout << "hi"` (缺少 iostream) → `1:14 variable cout does not exist` |
| 运行时错误 | ✅ 错误消息 | `1/0` → `overflow of Infinity(unsigned int)` |
| 超时（无限循环）| ⚠️ 部分 | `setTimeout` 能发 timeout 消息，但 Worker 线程可能卡死 |

## 文件结构

```
src/
├── main.tsx                    # React 入口
├── index.css                   # Tailwind + 自定义样式
├── app/
│   ├── App.tsx                 # 主界面布局
│   └── store.ts                # Zustand 状态管理
├── editor/
│   └── EditorView.tsx          # Monaco Editor 封装
├── ide/
│   ├── IDEController.ts        # Worker 通信控制器
│   └── Terminal.tsx            # 终端输出面板
├── sandbox/
│   ├── types.ts                # Worker 通信协议
│   └── helpers.ts              # 辅助函数
├── types/
│   └── jscpp.d.ts              # JSCPP 类型声明
worker/
└── interpreter.worker.ts       # JSCPP 执行 Worker
```

## 启动方式

```bash
# 需要 Node 24 路径
export PATH="/c/Users/aww/AppData/Roaming/fnm/node-versions/v24.18.0/installation:$PATH"

cd C:\yoyac-work\IDE
npm run dev
# 打开 http://localhost:5174
```

## 已知问题

1. **无限循环卡死 Worker** — `JSCPP.run()` 是同步阻塞的，`setTimeout` 在同线程无法打断。需要 Phase 1 用 Web Worker `terminate()` 改进。
2. **调试按钮无效** — JSCPP 不支持步进/中断，点击返回"需要自研解释器"提示。Phase 3-4 实现。
3. **错误行号解析粗糙** — 用正则 `/line\s+(\d+)/i` 猜行号，不精确。Phase 4 自研解释器提供结构化错误。
4. **PostCSS 配置** — 必须用 `.cjs` 格式（`postcss.config.cjs`），`.js` 格式在 `type: module` 项目下会报 `module not found`。
5. **`@monaco-editor/react` 需要 CDN** — Monaco 字体资源从 CDN 加载，离线场景需额外处理。

## 产出物

- 20 个文件，4899 行代码
- 已推送到 `git@github.com:yoy-aww/IDE.git`
- 构建产物：`dist/`（6 个文件，最小 gzip 11.33 kB）
