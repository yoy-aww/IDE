# Phase 2: 编辑器集成

> 完善编辑体验：Monaco 本地化、快捷键、状态栏、持久化、更多示例。

## 目标

Phase 0-1 建立了"写代码→运行→看到输出"的核心链路，但编辑器体验还不够完整。Phase 2 聚焦"错误定位 + 断点 + 终端"三个方向，让 IDE 像 VSCode 一样好用。

## 做了什么

### 1. Monaco 本地打包

**问题：** `@monaco-editor/react` 默认从 CDN 加载 Monaco 资源。少儿教室经常断网，编辑器直接白屏。

**解决：** 用 `loader.config({ monaco })` 指定本地安装的 monaco-editor 包：

```ts
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'

// 使用本地安装的 monaco-editor，不依赖 CDN
loader.config({ monaco })
```

**影响：** 构建产物从 6 个文件变为 80+ 个文件（Monaco 语言模块独立分包），但离线可用。`dist/` 体积从 ~600KB 增至 ~3.2MB（Monaco 核心），gzip 后 ~846KB。对本地部署场景可接受。

### 2. 键盘快捷键

| 快捷键 | 功能 | 条件 |
|---|---|---|
| `Ctrl+Enter` | 运行程序 | 任意时候 |
| `Ctrl+C` | 终止执行 | 仅运行中 |

全局监听 `window.keydown` 事件，避免编辑器内部拦截。

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault()
      ideController.run()
    }
    if (e.ctrlKey && e.key === 'c' && sandboxIsRunning()) {
      e.preventDefault()
      ideController.interrupt()
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

按钮上加了 `title` 属性提示快捷键。

### 3. 状态栏

底部状态栏显示：

| 左侧 | 右侧 |
|---|---|
| 行号、列号 | 断点数 |
| 总行数 | 错误行号 |
| 语言 (C++) | 运行状态指示器 |

光标位置通过 `editor.onDidChangeCursorPosition` 回调实时更新到 store。

```tsx
<EditorView
  onCursorChange={(line, col) => setCursor(line, col)}
  ...
/>
```

### 4. localStorage 持久化

`zustand/middleware` 的 `persist` 中间件自动将状态同步到 localStorage。

```ts
export const useIDEStore = create<IDEStore>()(
  persist(
    (set) => ({ /* ... */ }),
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
```

只持久化 `code`、`stdin`、`breakpoints` 三个字段，`result`/`status` 等运行时状态不保存。页面刷新后代码不丢。

### 5. 终端增强

**一键复制：** 点击复制按钮，将 stdout + stderr + errorMessage 复制到剪贴板。

```ts
const text = [result?.stdout, result?.stderr, result?.errorMessage]
  .filter(Boolean)
  .join('\n')
navigator.clipboard.writeText(text).catch(() => {})
```

**一键清除：** 顶栏增加清除按钮（仅当有结果时显示），调用 `clearResult()` 清空终端和状态。

**错误分类显示：**

| 状态 | 样式 | 图标 |
|---|---|---|
| 语法错误 | 红色 | ⚠️ 错误 |
| 运行时错误 | 红色 | ⚠️ 错误 |
| 执行超时 | 黄色 | ⏰ 超时 |
| 正常输出 | 绿色 | (无) |

**自动滚动：** 新输出到达时自动滚动到底部。

```ts
useEffect(() => {
  const el = scrollRef.current
  if (el && result) {
    el.scrollTop = el.scrollHeight
  }
}, [result])
```

### 6. 光标回调

EditorView 新增 `onCursorChange` 回调，光标移动时实时更新 store 中的 `cursorLine`/`cursorCol`，供状态栏使用。

### 7. 示例代码库扩充

从 9 个扩充到 16 个，新增：

| 示例 | 覆盖 |
|---|---|
| while 循环 | `while` 语法 |
| do-while 循环 | `do-while` 语法 |
| 嵌套循环 | 双层 `for`，打印三角形 |
| 数学运算 | `sqrt`、`pow`、`abs`、`max` |
| 二维数组 | `int[3][3]` 矩阵 |
| 三元运算符 | 条件表达式 |
| 输入输出 | `cin >>` + `cout <<`，含 stdin 预设 |

### 8. 侧栏快捷键提示

侧栏底部增加快捷键提示区，方便学生快速学习。

## 文件变更

| 文件 | 变更 |
|---|---|
| `src/editor/EditorView.tsx` | 本地 Monaco、光标回调、`onEditorMount` 回调 |
| `src/app/store.ts` | `zustand/middleware persist`、`cursorLine`/`cursorCol` |
| `src/app/App.tsx` | 状态栏组件、键盘快捷键、示例扩充、清除按钮 |
| `src/ide/Terminal.tsx` | 一键复制、一键清除、自动滚动、错误分类 |

## 构建产物变化

| 指标 | Phase 1 | Phase 2 |
|---|---|---|
| 文件数 | 6 | 80+ |
| 总大小 | ~600 KB | ~3.2 MB |
| gzip 后 | ~100 KB | ~846 KB |
| 离线可用 | ❌ CDN 依赖 | ✅ 本地打包 |

> Monaco 体积大是正常现象（包含 40+ 语言支持模块）。如果只保留 C++ 语法高亮，可以手动配置 `monaco-editor/esm/vs/basic-languages/cpp/cpp.js`，预计可减到 ~1MB。当前阶段不做优化。

## 验证记录

| 测试项 | 结果 | 说明 |
|---|---|---|
| TypeScript 编译 | ✅ | `tsc -b --noEmit` 零错误 |
| Vite 构建 | ✅ | 10.01s，1082 模块 |
| 构建产物 | ✅ | 80+ 文件，gzip 846 KB |
| Monaco 本地化 | ✅ | `loader.config({ monaco })` 生效 |
| 光标回调 | ✅ | `onCursorChange` 实时更新 |
| localStorage | ✅ | `persist` 中间件工作正常 |

## 架构演进

```
Phase 0:  EditorView (CDN Monaco) → 直接渲染
Phase 1:  EditorView (CDN Monaco) → 断点/错误高亮
Phase 2:  EditorView (本地 Monaco) → 光标回调 → store → 状态栏
                                          → persist → localStorage
```

## 已知问题

1. **Monaco 体积大** — 3.2MB 包含 40+ 语言模块。Phase 5 优化：只保留 C++ 语法高亮。
2. **Ctrl+C 冲突** — 浏览器原生 Ctrl+C 是复制操作。当前仅在运行中拦截，不运行时正常复制。
3. **localStorage 容量** — 浏览器 localStorage 通常 5-10MB。大量代码累积后可能超限，Phase 5 考虑 IndexedDB。
