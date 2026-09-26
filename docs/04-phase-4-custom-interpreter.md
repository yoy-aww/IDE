# Phase 4: 自研解释器

> 从零实现 C++ 词法分析、语法分析、解释执行引擎。

## 目标

Phase 1-3 基于 JSCPP 完成全链路验证。JSCPP 的局限：
- 同步阻塞执行，无法中途暂停
- 无 AST 暴露，不能做步进调试
- 标准库有限，缺 vector/string/algorithm
- 错误消息格式不稳定

本阶段实现自研解释器，核心：
1. **词法分析**（Lexer）— 将 C++ 源码拆分为 Token 流
2. **语法分析**（Parser）— 将 Token 流构建为 AST（抽象语法树）
3. **解释执行**（Evaluator）— 遍历 AST，模拟 C++ 运行时

## 架构

```
C++ 源码
    │
    ▼
┌──────────────┐
│   Lexer      │  279 行
│  词法分析器   │  字符 → Token
└──────┬───────┘
       │ Token[]
       ▼
┌──────────────┐
│   Parser     │  683 行
│  语法分析器   │  Token → AST
└──────┬───────┘
       │ AST
       ▼
┌──────────────┐
│  Evaluator   │  661 行
│  解释执行器   │  AST → 执行
└──────┬───────┘
       │ stdout/stderr
       ▼
   输出结果
```

入口：`src/interpreter/index.ts`
Worker：`worker/interpreter.worker.ts`

## 支持的语言特性

### 数据类型
- `int` / `double` / `float` / `char` / `bool`
- 基本类型字面量（数字、浮点、字符、字符串、布尔）

### 控制流
- `if` / `else` / `else if`
- `while` / `do-while`
- `for`（含初始化、条件、更新）
- `switch` / `case` / `default` / `break` / `continue`
- 三元表达式 `cond ? a : b`

### 函数
- 函数定义与调用（支持参数）
- `return` 语句
- 递归调用
- 标准库函数：`abs` / `sqrt` / `pow` / `max` / `min` / `rand`

### 数组
- 一维数组声明与初始化 `int arr[5] = {0};`
- 数组元素赋值与读取 `arr[i] = value;`
- 数组作为参数传递

### 运算符
- 算术：`+` `-` `*` `/` `%`
- 比较：`==` `!=` `<` `>` `<=` `>=`
- 逻辑：`&&` `||` `!`
- 位运算：`&` `|` `^` `~` `<<` `>>`
- 赋值：`=` `+=` `-=` `*=` `/=` `%=`
- 自增/自减：`++` `--`（前缀/后缀）

### 其他
- `cout << ... << endl;` 输出
- 复合表达式 `cout << (a + b) * 2 << endl;`
- 括号优先级

## 不支持的特性（待完善）

- `vector` / `string` / `map` 等 STL 容器
- `struct` / `class` 结构体
- `template` 模板
- `namespace` 命名空间（仅跳过 using 指令）
- `cin >>` 输入（Worker 接收 stdin 但尚未实现读取逻辑）
- 指针（简化处理，`&` 和 `*` 不做真正地址运算）
- 文件 I/O
- 位域 / 联合体

## 实现细节

### Lexer（词法分析器）

```typescript
// src/interpreter/lexer.ts
export type TokenType = 'Number' | 'Float' | 'Char' | 'String' 
  | 'Identifier' | 'Keyword' | 'Operator' | 'Punctuation' | 'EndOfInput'

export interface Token {
  type: TokenType
  value: string
  line: number
  col: number
}

export function tokenize(code: string): Token[] { ... }
```

- 识别所有 C++ 关键字（int/void/if/else/for/while/do/switch/case/default/break/continue/return 等）
- 多字符运算符优先匹配（`<=` `>=` `==` `!=` `+=` 等）
- 预处理指令（`#include` `#define`）直接跳过
- 行/列号追踪用于错误报告

### Parser（语法分析器）

采用**递归下降**解析，按运算符优先级递增：

```
parseExpression()
  └─ parseTernary()          三元 ?:
     └─ parseAssignment()    赋值 = += -= ...
        └─ parseOr()         逻辑或 ||
           └─ parseAnd()     逻辑与 &&
              └─ parseEquality()   == !=
                 └─ parseRelational()   < > <= >=
                    └─ parseShift()     << >>
                       └─ parseAdditive()    + -
                          └─ parseMultiplicative()  * / %
                             └─ parseUnary()     ! ~ - + & * ++ --
                                └─ parsePostfix() 调用() 下标[] 成员.
                                   └─ parsePrimary() 字面量/标识符/括号
```

- AST 使用 TypeScript 联合类型（discriminated union by `type` 字段）
- 每个 AST 节点携带 `line` / `col` 用于错误报告
- `#include` / `using` 指令被跳过（返回 `_skip` 占位 VarDecl）

### Evaluator（解释执行器）

```typescript
export class Interpreter {
  run(program: ProgramNode, stdin: string, breakpoints: number[]): void
  execute(node: ASTNode): void    // 执行语句
  eval(node: ASTNode): CppValue   // 求值表达式
}
```

- **作用域链**：每进入 BlockStmt/Function 创建新 Scope，变量查找向上回溯
- **控制流**：用自定义异常（`ReturnSignal` / `BreakSignal` / `ContinueSignal`）实现
- **函数调用**：查函数表 → 创建作用域 → 绑定参数 → 执行函数体 → 返回
- **超时控制**：每个节点执行前检查 `Date.now() - startTime > timeoutMs`

## 测试

28 个测试用例全部通过：

```
tests/interpreter.test.ts
├── 基础输出（1）
├── 变量与运算（2）
├── 控制流（4）— if-else, for, while, switch
├── 函数（2）— 简单调用, 递归
├── 数组（1）
├── 错误处理（2）
├── 输入（1）
├── 标准库函数（5）— abs, max, min, sqrt, pow
└── 综合示例（3）— 九九乘法表, 质数判断, 冒泡排序
```

## 文件清单

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/interpreter/lexer.ts` | 279 | 词法分析器 |
| `src/interpreter/parser.ts` | 683 | 语法分析器 |
| `src/interpreter/evaluator.ts` | 661 | 解释执行器 |
| `src/interpreter/index.ts` | 40 | 入口（串联三者） |
| `worker/interpreter.worker.ts` | 25 | Web Worker 沙箱 |
| `tests/interpreter.test.ts` | 200 | 测试用例 |

## 下一步（Phase 5）

1. **教学辅助**：错误提示友好化、示例库扩充
2. **性能优化**：避免不必要的 AST 遍历
3. **STL 支持**：vector / string / map
4. **cin 输入**：实现 `cin >> var` 从 stdin 读取
5. **指针**：真正的指针语义
