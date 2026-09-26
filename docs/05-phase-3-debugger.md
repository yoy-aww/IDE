# Phase 3: 调试器 — 步进、断点、变量监视、调用栈

> 让程序"慢下来"，逐行执行，看到变量怎么变。

## 核心思路：为什么选择"探测+重跑"？

浏览器里做 C++ 解释器调试，有两条路：

| 方案 | 原理 | 优点 | 缺点 |
|---|---|---|---|
| **协程/生成器** | `yield` 每步执行状态 | 真正的单步，无重跑 | JS Generator 不支持 C++ 的 break/continue/return 跨作用域传播 |
| **快照恢复** | 序列化 AST + 作用域 → 恢复 | 精确，可跳任意行 | 快照序列化复杂 |
| **探测+重跑** ✅ | 重跑整段代码到目标行 | 简单可靠，无状态管理 | 大程序慢（教学场景 <100 行无影响） |

选了**探测+重跑**：教学场景代码短，每次单步重新执行从头跑到目标行，代码简单、不容易出 bug。

## 整体流程

```
用户点 F5/调试
       │
       ▼
 IDEController.debugStart()
       │
       ▼
 Worker 收到 debug_start
       │
       ▼
 Interpreter.debugMode = true
       │
       ▼
 遍历 AST 执行，每行检查断点
       │
       ▼
 到达断点 → throw PauseSignal(状态快照)
       │
       ▼
 Worker 捕获 PauseSignal → 发送 debug_paused 消息
       │
       ▼
 前端显示：当前行高亮 + 变量面板 + 调用栈

用户点 F10/步进
       │
       ▼
 Worker 收到 debug_step + currentLine
       │
       ▼
 probeLines() 探测从 currentLine 的下一个行号
       │
       ▼
 设置新断点 → 重跑到目标行 → PauseSignal
       │
       ▼
 前端更新：行号前进 + 变量刷新
```

## 架构变更

### 1. Evaluator 改造（evaluator.ts）

新增 `PauseSignal` 类——到达断点时抛出，携带当前快照：

```ts
export class PauseSignal extends Error {
  line: number                    // 暂停的行号
  variables: VariableInfo[]       // 当前作用域变量
  callStack: CallFrame[]          // 函数调用栈
  stdout: string                  // 已产生的输出
  atBreakpoint: boolean           // 是否因断点暂停
}
```

新增 `probeLines()`——探测执行路径，获取"下一步要执行的行号"：

```ts
// 模拟执行，但不设置断点，记录所有访问的行号
// skipLines: 已执行的行（下次单步时跳过）
probeLines(program, stdin, skipLines): number[] {
  // 递归遍历 AST，模拟条件分支和循环
  // 返回: [行号序列]
}
```

新增调用栈跟踪——`callStack` 从 `string[]` 升级为 `CallFrame[]`：

```ts
interface CallFrame {
  name: string      // 函数名
  line: number      // 函数定义行号
}
```

新增变量快照工具——`collectVariables()` 遍历作用域链，收集所有变量（跳过 cout/cin/endl 等内部标记），`serializeValue()` 将 CppValue 转为可传输的 JSON。

### 2. 通信协议扩展（types.ts）

WorkerRequest 新增调试消息：

```ts
type: 'run' | 'debug_start' | 'debug_step' | 'debug_continue' | 'debug_stop'
breakpoints: number[]       // 断点列表
currentLine?: number        // 当前执行到的行
debugMode?: 'next' | 'into' | 'out'  // 单步模式
```

WorkerResult 新增调试响应：

```ts
type: 'result' | 'timeout' | 'error' | 'debug_paused' | 'debug_done'
debugState?: {
  currentLine: number
  variables: Variable[]
  callStack: CallFrame[]
  stdout: string
  atBreakpoint: boolean
}
```

### 3. Worker 调试处理（interpreter.worker.ts）

三种调试操作：

- **debug_start** — 设置断点，从头运行。遇到断点 → `PauseSignal` → `debug_paused` 消息
- **debug_step** — 用 `probeLines()` 探测下一个行号，设置临时断点，重跑
- **debug_continue** — 不设新断点，运行到下一个用户断点

### 4. 沙箱层（sandbox.ts）

新增 `debugStart` / `debugStep` / `debugContinue` 三个方法，每个都是启动新 Worker 发消息。与 `run()` 共享超时控制和 terminate 机制。

### 5. IDE 控制器（IDEController.ts）

新增四个方法：

- `debugStart()` — 启动调试
- `debugStep('next' | 'into' | 'out')` — 单步
- `debugContinue()` — 继续
- `debugStop()` — 终止调试

调试状态下 `interrupt()` 会停止调试而不是中断运行。

### 6. UI 变更（App.tsx + store.ts）

调试工具栏（仅在调试时显示）：

| 按钮 | 快捷键 | 功能 |
|---|---|---|
| 继续 ▶ | F5/F9 | 运行到下一个断点 |
| 步进 ⏭ | F10 | 单步执行（不进入函数） |
| 停止 ⏹ | - | 终止调试会话 |

正常工具栏新增"调试 🔍"按钮（F5），与"运行 ▶"并列。

侧边栏新增**调用栈面板**——调试暂停时显示当前函数调用链：

```
main()         · 第 3 行
factorial()    · 第 10 行
factorial()    · 第 10 行
```

**变量面板**已存在，现在会随单步更新。

## 使用流程

```
1. 写代码
2. 点击行号左侧 → 设置断点（红色圆点）
3. 点"调试"按钮或 F5
4. 程序在第一个断点暂停
   → 侧边栏显示变量值和调用栈
5. 按 F10 单步执行 → 下一行暂停，变量刷新
6. 按 F5/F9 继续 → 跑到下一个断点
7. 按 Ctrl+C 停止调试
```

## 当前限制

- **单步模式**只支持 `next`（不进入函数），`into`/`out` 待实现
- 每次单步都重跑整段代码（教学场景 <100 行可接受，大程序需改为快照方案）
- 断点不能设在函数参数行、预处理指令行等无 AST 节点的位置
- 调用栈只追踪用户函数，不追踪内置函数

## 文件变更

```
src/interpreter/evaluator.ts     +326 行  PauseSignal + probeLines + 调用栈
src/sandbox/types.ts             +22 行   调试消息协议
worker/interpreter.worker.ts     +159 行  三种调试操作处理
src/sandbox/sandbox.ts           +147 行  debugStart/Step/Continue API
src/ide/IDEController.ts         +184 行  调试会话管理
src/app/App.tsx                  +181 行  调试工具栏 + 调用栈面板 + 快捷键
src/app/store.ts                 +6 行    debugMode 状态
```
