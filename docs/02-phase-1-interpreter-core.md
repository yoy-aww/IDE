# Phase 1: 解释器核心

> 解决 Phase 0 的三个核心问题：Worker 超时失效、缺少输入支持、错误消息解析粗糙。

## 目标

Phase 0 跑通了最短链路，但留下了三个生产级问题：

| 问题 | 影响 | Phase 0 方案 |
|---|---|---|
| Worker 超时失效 | 无限循环卡死浏览器 | Worker 内 `setTimeout`（不可靠） |
| 缺少 cin >> 支持 | 输入类程序无法运行 | 未实现 |
| 错误行号解析粗糙 | 只能正则猜，不精确 | `/line\s+(\d+)/i` |

Phase 1 要逐个解决这三个问题。

## 做了什么

### 1. Worker 超时控制（核心）

**问题根源：** JSCPP 的 `run()` 是**同步阻塞**的。在 Worker 内部：

```js
// ❌ Phase 0 方案 — 不工作
const timeoutId = setTimeout(() => {
  postResult({ type: 'timeout' })  // 永远不会执行！
}, 5000)

JSCPP.run(code, '', config)  // 同步阻塞，setTimeout 回调被冻结
```

JavaScript 是单线程的。当 `JSCPP.run()` 执行一个无限循环时，整个 Worker 线程被阻塞，事件循环停止，`setTimeout` 的回调永远不会被调度。

**Phase 1 方案：主线程 terminate**

```
主线程                          Worker 线程
  │                                │
  │  创建 Worker                   │
  │  启动 setTimeout(5s)           │
  │  发送代码给 Worker              │
  │                                │  JSCPP.run() 阻塞...
  │                                │  (无限循环中)
  │  5秒到了！                      │  (还在阻塞)
  │  worker.terminate() ──────────→ │  💥 被强制杀掉
  │  onTimeout() 回调               │
  │  下次重建 Worker                │
```

这是浏览器沙箱中处理同步阻塞代码的**唯一可靠方案**。`worker.terminate()` 是异步的，不需要 Worker 线程配合，直接回收线程资源。

**实现文件：** `src/sandbox/sandbox.ts`

```ts
function run(options: RunOptions): void {
  // ...
  isExecuting = true
  const w = createFreshWorker()

  // 超时由主线程管理
  timeoutId = setTimeout(() => {
    isExecuting = false
    w.terminate()      // 强制杀掉 Worker
    worker = null      // 下次重建
    onTimeout()
  }, timeout)

  // Worker 返回结果时清除超时
  w.onmessage = (e) => {
    isExecuting = false
    clearTimeoutSafe()
    onResult(e.data)
    w.terminate()      // 正常完成也重置
    worker = null
  }
}
```

**关键设计：**
- 每次执行都创建**全新 Worker**（`createFreshWorker()`），避免 JSCPP 内部状态残留
- Worker 执行完立即 `terminate()` 并 `worker = null`，下次重建
- `interrupt()` 同样用 `terminate()` 实现，用户可随时中断

### 2. stdin 输入支持

**改动链路：**

```
Terminal 输入框 → store.stdin → IDEController.run() → sandbox.run() → Worker → JSCPP.run(code, stdin, config)
```

`JSCPP.run()` 的第二个参数就是 stdin 输入，Phase 0 一直传的是空字符串 `''`。Phase 1 改为传 store 里的 `stdin` 字段。

UI 上在 Terminal 面板顶部增加了一个输入行：

```
stdin: [用户输入区域        ]
──────────────────────────
[程序输出显示区域]
```

只有当用户输入了内容时，stdin 行才显示（`stdin !== ''` 条件渲染）。

### 3. 错误行号解析

**Phase 0：** 只有备选方案 `/line\s+(\d+)/i`，匹配不到就放弃。

**Phase 1：** JSCPP 的错误消息格式是 `"行:列 错误描述"`，例如：
- `1:14 variable cout does not exist`
- `3:1 cannot find library: vector`
- `2:5 overflow of Infinity(unsigned int)`

直接正则匹配 `^(\d+):(\d+)` 就能拿到行号和列号：

```ts
function parseErrorLine(msg: string): { errorLine?: number; errorCol?: number } {
  const match = msg.match(/^(\d+):(\d+)/)
  if (match) {
    return { errorLine: +match[1], errorCol: +match[2] }
  }
  // 备选
  const lineMatch = msg.match(/line\s+(\d+)/i)
  if (lineMatch) return { errorLine: +lineMatch[1] }
  return {}
}
```

### 4. Worker 通信协议简化

Phase 0 定义了一堆调试相关的消息类型（`debug_start`、`debug_step`、`debug_continue`、`debug_interrupt`），但 JSCPP 根本不支持步进调试。Phase 1 清理掉这些无用类型，只保留实际使用的：

```
前端 → Worker:
  { type: 'run', code: string, stdin: string }

Worker → 前端:
  { type: 'result', stdout, stderr, exitCode, errorLine?, errorCol?, errorMessage? }
  { type: 'timeout' }
  { type: 'error', errorMessage }
```

调试相关类型保留在 `store.ts` 的 `DebugState` 接口中（Phase 3+ 使用），但 Worker 通信协议已经精简。

### 5. IDEController 重构

Phase 0 的 `IDEController` 直接管理 Worker 生命周期。Phase 1 拆分为两层：

```
IDEController (UI 层)
  ↓ 调用
sandbox (沙箱层)
  ↓ 管理
Worker (执行层)
```

- `IDEController` 负责：store 状态同步、UI 回调映射
- `sandbox` 负责：Worker 创建/销毁、超时管理、消息路由

这样当 Phase 4 替换为自研解释器时，只需要改 `sandbox` 层，`IDEController` 完全不用动。

## 文件变更

| 文件 | 变更 |
|---|---|
| `src/sandbox/sandbox.ts` | **新增** — Worker 生命周期管理、超时控制 |
| `src/sandbox/types.ts` | 精简为 WorkerRequest/WorkerResult 实际字段 |
| `worker/interpreter.worker.ts` | 支持 stdin，正则解析错误行列号 |
| `src/ide/IDEController.ts` | 重构为 sandbox 调度模式 |
| `src/app/store.ts` | 新增 `stdin` / `setStdin` 字段 |
| `src/app/App.tsx` | 终端增加 stdin 输入框 |

## 验证记录

| 测试项 | 结果 | 说明 |
|---|---|---|
| TypeScript 编译 | ✅ | `tsc -b --noEmit` 零错误 |
| Vite 构建 | ✅ | `npm run build` 5.43s |
| 构建产物 | ✅ | 6 文件，gzip 总计 80.42 kB |
| 超时代码 | ⚠️ 待浏览器验证 | Worker 内 `setTimeout` 确认不触发（JSCPP 阻塞） |
| stdin 输入 | ⚠️ 待浏览器验证 | JSCPP `run()` 的 stdin 参数已传递 |
| 错误行号 | ⚠️ 待浏览器验证 | 正则 `^(\d+):(\d+)` 已覆盖 JSCPP 格式 |

## 已知问题

1. **JSCPP eval 安全警告** — Vite 构建时 9 处 `eval()` 警告。JSCPP 内部用 `eval()` 做动态执行，Phase 4 自研解释器会消除这个风险。
2. **printf/stream 外化** — JSCPP 依赖的 `printf` 库引用了 Node 的 `util` 和 `stream` 模块，Vite 自动外化。不影响功能，但在生产环境有额外开销。
3. **Worker 重复创建** — 每次执行都 `terminate()` + 重建 Worker。在快速连续运行时（如自动运行），有初始化开销。Phase 3+ 考虑 Worker 池化。

## 架构演进

```
Phase 0:  IDEController ──→ Worker ──→ JSCPP
          (直接管理 Worker)

Phase 1:  IDEController ──→ sandbox ──→ Worker ──→ JSCPP
          (UI 调度)         (沙箱层)     (执行层)

Phase 4:  IDEController ──→ sandbox ──→ Worker ──→ 自研解释器
          (不改)             (不改)        (不改协议)      (替换)
```

`sandbox` 层是 Phase 1 引入的关键抽象——它隔离了 Worker 生命周期管理，Phase 4 只需替换 Worker 内部实现。
