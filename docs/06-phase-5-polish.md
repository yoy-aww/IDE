# Phase 5: 打磨 — 教学辅助、错误提示、测试覆盖

> 把工程变成产品：少儿能看懂、老师能教、代码能跑。

## 改动总览

| 维度 | Phase 0-4 | Phase 5 改进 |
|---|---|---|
| 错误提示 | 技术性（"unexpected token"） | 友好化（"语法错误：符号放错位置了"） |
| 运行时安全 | 除以零静默返回 NaN | 除以零报错提示 |
| 类型系统 | char 和 int 混为一谈 | CppChar 包装类型，`cout << 'A'` 输出 'A' |
| 强制转换 | 不支持 `(int)c` | CStyleCast 完整支持 |
| 教学示例 | 16 个 | 22 个 |
| 测试覆盖 | 21 个 | 30 个 |

## 1. 友好错误提示

**问题：** 原始错误消息是给程序员看的，少儿看不懂。

**之前：**
```
SyntaxError: 10:15 期望 Punctuation，实际得到 "}"
```

**之后：**
```
语法错误：这里应该写一个特定的符号。10:15 期望 Punctuation，实际得到 "}"
```

实现方式：在 `index.ts` 的 `run()` 函数中，catch 块通过 `friendlyError()` 转换错误消息。

```ts
function friendlyError(msg: string): string {
  if (msg.includes('意外的 token')) {
    return `语法错误：这里有个符号放错位置了。${msg}`
  }
  if (msg.includes('期望')) {
    return `语法错误：这里应该写一个特定的符号。${msg}`
  }
  if (msg.includes('超时')) {
    return '⏰ 程序执行时间太长啦！检查一下是不是写了无限循环。'
  }
  if (msg.includes('未定义的函数')) {
    return `这个函数还没有定义哦。${msg}`
  }
  return msg  // 未知错误原样返回
}
```

## 2. 除以零运行时检查

**问题：** C++ 除以零是未定义行为，浏览器中 `10/0` 返回 `Infinity`，少儿完全看不懂。

**之前：**
```cpp
int a = 10; int b = 0; cout << (a / b) << endl;
// 输出: Infinity
```

**之后：**
```cpp
int a = 10; int b = 0; cout << (a / b) << endl;
// 错误: 算术错误：不能除以 0。除数 "0" 为 0。
```

实现方式：在 `evaluator.ts` 中添加 `safeDiv` 和 `safeMod` 函数，替换 `BinaryExpr` 中的 `/` 和 `%` 运算。

```ts
function safeDiv(a: CppValue, b: CppValue): number {
  const bv = b as number
  if (bv === 0) throw new Error(`算术错误：不能除以 0。除数 "${String(bv)}" 为 0。`)
  return (a as number) / bv
}
```

## 3. 字符类型正确输出

**问题：** CharLiteral 存的是 ASCII 数字（65），`cout << 'A'` 输出了 `65` 而非 `A`。

**之前：**
```cpp
char c = 'A';
cout << c << endl;    // 输出: 65（错！）
cout << (int)c << endl; // 输出: 65（对，但 char 也应该能输出字符）
```

**之后：**
```cpp
char c = 'A';
cout << c << endl;     // 输出: A（对！）
cout << (int)c << endl; // 输出: 65（对！）
```

### CppChar 包装类型

引入 `CppChar` 接口，区分字符和数字：

```ts
export interface CppChar {
  type: 'char'
  value: number  // ASCII code
}

export type CppValue = number | boolean | string | null | CppArray | CppMap | CppChar
```

### formatValue 区分 char 和 int

```ts
function formatValue(value: CppValue): string {
  // ...
  if (isCppObject(value) && value.type === 'char') {
    return String.fromCharCode((value as CppChar).value)  // 65 → 'A'
  }
  // number 输出数字
  // ...
}
```

### 类型守卫 isCppObject

由于 `CppValue` 包含 `string`，而 `string` 也有隐式的 `type` 属性，直接 `value.type` 会类型错误。使用类型守卫：

```ts
function isCppObject(v: CppValue): v is CppArray | CppMap | CppChar {
  return v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean'
}
```

## 4. CStyleCast 强制转换

**问题：** `(int)c` 被解析器当作语法错误，因为 parser 不认识 `(` + type + `)` 的模式。

### Parser 改动

在 `parseUnary()` 中检测 `(type)` 模式：

```ts
// C 风格强制转换: (int)expr, (double)expr, (char)expr, etc.
if (this.check('Punctuation', '(')) {
  const save = this.pos
  this.advance()  // consume '('
  if (this.peek().type === 'Keyword') {
    const typeName = this.peek().value
    if (['int', 'double', 'float', 'char', 'bool', 'long', 'short', 'unsigned'].includes(typeName)) {
      this.advance()  // consume type keyword
      if (this.check('Punctuation', ')')) {
        this.advance()  // consume ')'
        const operand = this.parseUnary()
        return { type: 'CStyleCast', line: paren.line, col: paren.col, castType: typeName, operand }
      }
    }
  }
  this.pos = save  // restore
}
```

关键：**look-ahead + 回退**——如果 `(` 后面不是类型关键字，回退到原位置，让 `parsePrimary` 处理为正常括号表达式。

### Evaluator 改动

在 `eval()` 中添加 `CStyleCast` 求值：

```ts
case 'CStyleCast': {
  const val = this.eval(cast.operand)
  switch (cast.castType) {
    case 'int':
      return typeof val === 'number' ? Math.trunc(val)
        : (isCppObject(val) && val.type === 'char' ? (val as CppChar).value : 0)
    case 'double':
    case 'float':
      return typeof val === 'number' ? val
        : (isCppObject(val) && val.type === 'char' ? (val as CppChar).value : 0)
    case 'char':
      if (typeof val === 'number') return { type: 'char', value: Math.trunc(val) } as CppChar
      return val
    case 'bool':
      return isTruthy(val)
    default:
      return val
  }
}
```

## 5. 教学示例扩充（16 → 22）

新增 6 个示例，覆盖更多教学场景：

| 示例 | 知识点 | 难点 |
|---|---|---|
| 斐波那契数列 | 递归 | 递归终止条件、重叠子问题 |
| 猜数字游戏 | 循环 + 条件 + 输入 | `cin` 多次输入、`while` 循环条件 |
| 闰年判断 | 复合条件 | 三目运算符 + 多条件组合 |
| 图形打印 | 嵌套循环 | 双层循环嵌套、空格控制 |
| 数字金字塔 | 嵌套循环 + 数字格式化 | 空格 + 数字混合打印 |
| 简易计算器 | 函数 + switch | `switch` 处理字符、函数参数传递 |

## 6. 测试覆盖扩充（21 → 30）

新增 9 个测试用例，覆盖边界情况和错误处理：

### 边界与错误（6 个）
| 测试 | 验证 |
|---|---|
| 除以零报错 | `/` 操作数右操作数为 0 时报错 |
| 取模除以零报错 | `%` 操作数右操作数为 0 时报错 |
| 数组越界访问 | 越界返回 0，不崩溃 |
| 空代码 | 空字符串不报错 |
| 只有 return 0 | 最小合法程序 |
| 多行输出 | 多行 `cout` 正确输出 |

### 字符串与字符（3 个）
| 测试 | 验证 |
|---|---|
| 字符串输出 | 字符串拼接 |
| 字符输出 | `cout << 'A'` 输出字符而非 ASCII |
| 字符转数字 | `(int)c` 强制转换 |

## 文件变更

```
src/interpreter/index.ts     +25 行   友好错误消息转换
src/interpreter/evaluator.ts +76 行   CppChar + safeDiv/safeMod + CStyleCast + 类型守卫
src/interpreter/parser.ts    +20 行   CStyleCast 语法解析
src/app/App.tsx              +164 行  6 个新教学示例
tests/interpreter.test.ts    +120 行  9 个新测试用例
```

## 验证结果

```
✓ 30/30 tests passed
✓ tsc --noEmit 无错误
✓ vite build 成功
```
