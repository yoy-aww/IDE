// ─── 解释执行器 ───────────────────────────────────────────────────────
// 遍历 AST 执行 C++ 代码，支持变量追踪、断点、步进调试

import type {
  ASTNode, ProgramNode, FunctionDeclNode, VarDeclNode, BlockStmtNode,
  IfStmtNode, WhileStmtNode, DoWhileStmtNode, ForStmtNode, SwitchStmtNode,
  CaseStmtNode, ReturnStmtNode, ExprStmtNode, BinaryExprNode, UnaryExprNode,
  CallExprNode, MemberExprNode, IndexExprNode, TernaryExprNode, AssignExprNode,
  NumberLiteralNode, FloatLiteralNode, CharLiteralNode, StringLiteralNode,
  BoolLiteralNode, IdentifierNode, ParamDeclNode, ArrayInitExprNode,
  CStyleCastNode,
} from './parser'

// ─── 值类型 ────────────────────────────────────────────────────────────

export type CppValue =
  | number
  | boolean
  | string
  | null
  | CppArray
  | CppMap
  | CppChar

export interface CppArray {
  type: 'array'
  data: CppValue[]
}

export interface CppMap {
  type: 'map'
  data: Map<string, CppValue>
}

export interface CppChar {
  type: 'char'
  value: number  // ASCII code
}

export interface VariableInfo {
  name: string
  value: CppValue
  type: string
  line: number
}

export interface DebugSnapshot {
  currentLine: number
  variables: VariableInfo[]
  callStack: { functionName: string; line: number }[]
  stdout: string
  paused: boolean
}

// ─── 作用域 ────────────────────────────────────────────────────────────

interface Scope {
  parent: Scope | null
  variables: Map<string, CppValue>
}

function createScope(parent: Scope | null): Scope {
  return { parent, variables: new Map() }
}

function lookupVariable(scope: Scope, name: string): { scope: Scope; value: CppValue } | null {
  let current: Scope | null = scope
  while (current) {
    if (current.variables.has(name)) {
      return { scope: current, value: current.variables.get(name)! }
    }
    current = current.parent
  }
  return null
}

function lookupAndAssign(scope: Scope, name: string, value: CppValue): boolean {
  let current: Scope | null = scope
  while (current) {
    if (current.variables.has(name)) {
      current.variables.set(name, value)
      return true
    }
    current = current.parent
  }
  return false
}

function setVariable(scope: Scope, name: string, value: CppValue): void {
  if (lookupAndAssign(scope, name, value)) return
  scope.variables.set(name, value)
}

function isCppObject(v: CppValue): v is CppArray | CppMap | CppChar {
  return v !== null && typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean'
}

// ─── 函数存储 ──────────────────────────────────────────────────────────

interface FunctionInfo {
  name: string
  params: ParamDeclNode[]
  returnType: string
  body: BlockStmtNode
  line: number
}

// ─── 异常 ──────────────────────────────────────────────────────────────

class ReturnSignal extends Error {
  value: CppValue
  constructor(value: CppValue) {
    super('return')
    this.value = value
  }
}

class BreakSignal extends Error {
  constructor() { super('break') }
}

class ContinueSignal extends Error {
  constructor() { super('continue') }
}

/** 调试暂停信号：解释器到达断点或目标行时抛出，携带当前状态 */
export class PauseSignal extends Error {
  line: number
  variables: { name: string; value: unknown; type: string; line: number }[]
  callStack: { functionName: string; line: number }[]
  stdout: string
  atBreakpoint: boolean

  constructor(state: {
    line: number
    variables: { name: string; value: unknown; type: string; line: number }[]
    callStack: { functionName: string; line: number }[]
    stdout: string
    atBreakpoint: boolean
  }) {
    super('pause')
    this.line = state.line
    this.variables = state.variables
    this.callStack = state.callStack
    this.stdout = state.stdout
    this.atBreakpoint = state.atBreakpoint
  }
}

interface CallFrame {
  name: string
  line: number
}

// ─── 辅助函数 ──────────────────────────────────────────────────────────

const STREAM_MARKER = '___STREAM___'

function isTruthy(value: CppValue): boolean {
  if (value === null) return false
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.length > 0
  if (isCppObject(value) && value.type === 'char') return (value as CppChar).value !== 0
  return true
}

/** 运行时安全检查：除以零 */
function safeDiv(a: CppValue, b: CppValue): number {
  const bv = b as number
  if (bv === 0) throw new Error(`算术错误：不能除以 0。除数 "${String(bv)}" 为 0。`)
  return (a as number) / bv
}

/** 运行时安全检查：取模除零 */
function safeMod(a: CppValue, b: CppValue): number {
  const bv = b as number
  if (bv === 0) throw new Error(`算术错误：取模运算不能除以 0。`)
  return (a as number) % bv
}

function valuesEqual(a: CppValue, b: CppValue): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b
  if (a === null && b === null) return true
  if (isCppObject(a) && a.type === 'char' && typeof b === 'number') return (a as CppChar).value === b
  if (isCppObject(b) && b.type === 'char' && typeof a === 'number') return (b as CppChar).value === a
  if (isCppObject(a) && isCppObject(b) && a.type === 'char' && b.type === 'char') return (a as CppChar).value === (b as CppChar).value
  return false
}

function formatValue(value: CppValue): string {
  if (value === null) return ''
  if (typeof value === 'boolean') return value ? '1' : '0'
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return String(value)
    return String(value)
  }
  if (typeof value === 'string') return value
  if (isCppObject(value) && value.type === 'array') return String((value as CppArray).data)
  if (isCppObject(value) && value.type === 'char') return String.fromCharCode((value as CppChar).value)
  return String(value)
}

// ─── 标准库函数 ─────────────────────────────────────────────────────────

const builtinFunctions: Record<string, (...args: CppValue[]) => CppValue> = {
  abs: (x) => Math.abs(x as number),
  sqrt: (x) => Math.sqrt(x as number),
  pow: (base, exp) => Math.pow(base as number, exp as number),
  max: (a, b) => Math.max(a as number, b as number),
  min: (a, b) => Math.min(a as number, b as number),
  rand: () => Math.floor(Math.random() * 32767),
}

// ─── 解释执行器 ────────────────────────────────────────────────────────

export class Interpreter {
  private stdout: string = ''
  private stderr: string = ''
  private globalScope: Scope = createScope(null)
  private functions: Map<string, FunctionInfo> = new Map()
  private stdinBuffer: string[] = []
  private breakpoints: Set<number> = new Set()
  private currentLine: number = 0
  private debugMode: boolean = false
  private callStack: CallFrame[] = []
  private timeoutMs: number = 5000
  private startTime: number = 0

  constructor() {
    this.globalScope = createScope(null)
    // 注册 cout 为流输出标记，cin 为流输入标记
    this.globalScope.variables.set('cout', STREAM_MARKER)
    this.globalScope.variables.set('cin', '__CIN__')
    this.globalScope.variables.set('endl', '\n')
  }

  run(program: ProgramNode, stdin: string, breakpoints: number[]): void {
    this.stdout = ''
    this.stderr = ''
    this.breakpoints = new Set(breakpoints)
    this.currentLine = 0
    this.callStack = []
    this.stdinBuffer = stdin.trim().split(/\s+/).filter(s => s.length > 0)

    // 第一遍：注册所有函数声明
    for (const decl of program.declarations) {
      if (decl.type === 'FunctionDecl') {
        this.registerFunction(decl as FunctionDeclNode)
      }
    }

    // 第二遍：执行所有顶层语句
    this.startTime = Date.now()
    for (const decl of program.declarations) {
      this.checkTimeout()
      this.execute(decl)
    }

    // 找到 main 并执行
    const main = this.functions.get('main')
    if (main) {
      try {
        this.execute(main.body)
      } catch (e) {
        if (e instanceof ReturnSignal) {
          // main 的 return 值，忽略
        } else if (e instanceof PauseSignal) {
          throw e  // 调试暂停信号需要传播到调用者
        } else {
          throw e
        }
      }
    }
  }

  /**
   * 探测执行：运行程序并记录所有执行的行号序列
   * 用于调试时确定"下一步"的行号
   */
  probeLines(program: ProgramNode, stdin: string, skipLines: number[]): number[] {
    const visited: number[] = []
    const skipSet = new Set(skipLines)

    // 重置状态
    this.stdout = ''
    this.stderr = ''
    this.breakpoints = new Set()  // 不设置断点，纯粹探测
    this.currentLine = 0
    this.callStack = []
    this.stdinBuffer = stdin.trim().split(/\s+/).filter(s => s.length > 0)
    this.debugMode = false
    this.startTime = Date.now()

    // 第一遍：注册函数
    for (const decl of program.declarations) {
      if (decl.type === 'FunctionDecl') {
        this.registerFunction(decl as FunctionDeclNode)
      }
    }

    // 第二遍：执行顶层语句
    for (const decl of program.declarations) {
      this.probeVisit(decl, visited, skipSet)
    }

    // 第三遍：执行 main
    const main = this.functions.get('main')
    if (main) {
      try {
        this.probeVisit(main.body, visited, skipSet)
      } catch (e) {
        if (e instanceof ReturnSignal || e instanceof BreakSignal || e instanceof ContinueSignal) {
          // 正常终止
        } else {
          throw e
        }
      }
    }

    return visited
  }

  /** 递归探测：访问节点的所有子节点，记录行号 */
  private probeVisit(node: ASTNode, visited: number[], skipSet: Set<number>): void {
    if (skipSet.has(node.line)) return
    visited.push(node.line)

    switch (node.type) {
      case 'BlockStmt': {
        const block = node as BlockStmtNode
        for (const stmt of block.statements) {
          this.probeVisit(stmt, visited, skipSet)
        }
        break
      }
      case 'IfStmt': {
        const ifNode = node as IfStmtNode
        const cond = this.eval(ifNode.condition)
        if (isTruthy(cond)) {
          this.probeVisit(ifNode.consequent, visited, skipSet)
        } else if (ifNode.alternate) {
          this.probeVisit(ifNode.alternate, visited, skipSet)
        }
        break
      }
      case 'WhileStmt': {
        // 最多循环 100 次防止无限循环
        for (let i = 0; i < 100; i++) {
          const cond = this.eval((node as WhileStmtNode).condition)
          if (!isTruthy(cond)) break
          this.probeVisit((node as WhileStmtNode).body, visited, skipSet)
        }
        break
      }
      case 'ForStmt': {
        const forNode = node as ForStmtNode
        const scope = createScope(this.globalScope)
        const oldScope = this.globalScope
        this.globalScope = scope
        try {
          if (forNode.init) this.execute(forNode.init)
          for (let i = 0; i < 100; i++) {
            if (forNode.condition) {
              const cond = this.eval(forNode.condition)
              if (!isTruthy(cond)) break
            }
            this.probeVisit(forNode.body, visited, skipSet)
            if (forNode.update) this.eval(forNode.update)
          }
        } finally {
          this.globalScope = oldScope
        }
        break
      }
      case 'VarDecl': {
        this.executeVarDecl(node as VarDeclNode)
        break
      }
      case 'ExprStmt':
        this.eval((node as ExprStmtNode).expression)
        break
      case 'CallExpr':
        this.evalCall(node as CallExprNode)
        break
      case 'FunctionDecl':
        this.registerFunction(node as FunctionDeclNode)
        break
      case 'ReturnStmt': {
        const rs = node as ReturnStmtNode
        if (rs.value) this.eval(rs.value)
        break
      }
      case 'SwitchStmt': {
        const sw = node as SwitchStmtNode
        const val = this.eval(sw.expression)
        for (const cs of sw.cases) {
          if (cs.value) {
            const caseVal = this.eval(cs.value)
            if (valuesEqual(val, caseVal)) {
              for (const stmt of cs.statements) {
                this.probeVisit(stmt, visited, skipSet)
              }
              break
            }
          }
        }
        break
      }
      default:
        // 叶子节点，不需要递归
        break
    }
  }

  getOutput(): { stdout: string; stderr: string } {
    return { stdout: this.stdout, stderr: this.stderr }
  }

  isTimeout(): boolean {
    return Date.now() - this.startTime > this.timeoutMs
  }

  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }

  setBreakpoints(bps: number[]): void {
    this.breakpoints = new Set(bps)
  }

  // ─── 内部方法 ────────────────────────────────────────────────────────

  private registerFunction(decl: FunctionDeclNode): void {
    this.functions.set(decl.name, {
      name: decl.name,
      params: decl.params,
      returnType: decl.returnType,
      body: decl.body,
      line: decl.line,
    })
  }

  private checkTimeout(): void {
    if (this.isTimeout()) {
      this.stderr += '执行超时\n'
      throw new Error('执行超时')
    }
  }

  /** 在调试模式下暂停，捕获当前状态并抛出 PauseSignal */
  private throwPause(line: number, atBreakpoint: boolean): void {
    const variables = this.collectVariables()
    const callStack = this.callStack.map(f => ({ functionName: f.name, line: f.line }))
    throw new PauseSignal({
      line,
      variables,
      callStack,
      stdout: this.stdout,
      atBreakpoint,
    })
  }

  /** 收集当前作用域链上的所有变量 */
  private collectVariables(): { name: string; value: unknown; type: string; line: number }[] {
    const result: { name: string; value: unknown; type: string; line: number }[] = []
    let scope: Scope | null = this.globalScope
    while (scope) {
      for (const [name, value] of scope.variables) {
        if (name === 'cout' || name === 'cin' || name === 'endl') continue
        result.push({
          name,
          value: this.serializeValue(value),
          type: this.inferType(value),
          line: this.currentLine,
        })
      }
      scope = scope.parent
    }
    // 去重（内层优先）
    const seen = new Set<string>()
    return result.filter(v => {
      if (seen.has(v.name)) return false
      seen.add(v.name)
      return true
    })
  }

  /** 将值序列化为可传输的格式 */
  private serializeValue(value: CppValue): unknown {
    if (value === null) return null
    if (typeof value === 'number') return value
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') return value
    if (isCppObject(value) && value.type === 'array') {
      return (value as CppArray).data.map(v => this.serializeValue(v))
    }
    if (isCppObject(value) && value.type === 'map') {
      const entries: Record<string, unknown> = {}
      for (const [k, v] of (value as CppMap).data) {
        entries[k] = this.serializeValue(v)
      }
      return entries
    }
    if (isCppObject(value) && value.type === 'char') {
      return String.fromCharCode((value as CppChar).value)
    }
    return String(value)
  }

  /** 推断值类型名称 */
  private inferType(value: CppValue): string {
    if (value === null) return 'null'
    if (typeof value === 'number') return Number.isInteger(value) ? 'int' : 'double'
    if (typeof value === 'boolean') return 'bool'
    if (typeof value === 'string') return 'string'
    if (isCppObject(value) && value.type === 'array') return 'vector'
    if (isCppObject(value) && value.type === 'map') return 'map'
    if (isCppObject(value) && value.type === 'char') return 'char'
    return 'unknown'
  }

  private print(value: CppValue): void {
    this.stdout += formatValue(value)
  }

  // ─── 节点执行 ────────────────────────────────────────────────────────

  execute(node: ASTNode): void {
    this.checkTimeout()
    this.currentLine = node.line

    // 调试模式：检查断点 → 暂停
    if (this.debugMode && this.breakpoints.has(node.line)) {
      this.throwPause(node.line, true)
    }

    switch (node.type) {
      case 'Program': {
        for (const decl of (node as ProgramNode).declarations) {
          this.execute(decl)
        }
        break
      }

      case 'FunctionDecl': {
        this.registerFunction(node as FunctionDeclNode)
        break
      }

      case 'VarDecl': {
        this.executeVarDecl(node as VarDeclNode)
        break
      }

      case 'ExprStmt': {
        const expr = (node as ExprStmtNode).expression
        // break/continue 检测（parser 不识别它们为语句，而是 Identifier）
        if (expr.type === 'Identifier') {
          const name = (expr as IdentifierNode).name
          if (name === 'break') {
            throw new BreakSignal()
          }
          if (name === 'continue') {
            throw new ContinueSignal()
          }
        }
        // return 检测
        if (expr.type === 'Identifier' && (expr as IdentifierNode).name === 'return') {
          // return 后面可能跟表达式
          const stmt = node as ExprStmtNode
          this.eval(stmt.expression)
          throw new ReturnSignal(0)
        }
        this.eval(expr)
        break
      }

      case 'ReturnStmt': {
        const rs = node as ReturnStmtNode
        const val = rs.value ? this.eval(rs.value) : 0
        throw new ReturnSignal(val)
      }

      case 'IfStmt':
        this.executeIf(node as IfStmtNode)
        break
      case 'WhileStmt':
        this.executeWhile(node as WhileStmtNode)
        break
      case 'DoWhileStmt':
        this.executeDoWhile(node as DoWhileStmtNode)
        break
      case 'ForStmt':
        this.executeFor(node as ForStmtNode)
        break
      case 'SwitchStmt':
        this.executeSwitch(node as SwitchStmtNode)
        break
      case 'BlockStmt':
        this.executeBlock(node as BlockStmtNode)
        break
      case 'CaseStmt':
        // case 语句本身不需要单独执行（在 switch 内处理）
        break
      default:
        this.eval(node)
        break
    }
  }

  private executeVarDecl(node: VarDeclNode): void {
    let value: CppValue = 0

    if (node.initializer) {
      // 初始化器存在，直接求值（包括数组初始化列表 {5,3,1,4,2}）
      value = this.eval(node.initializer)
    } else if (node.isArray && node.arraySize !== undefined) {
      // 无初始化器但声明了数组，创建全 0 数组
      value = { type: 'array', data: new Array(node.arraySize).fill(0) }
    }

    this.globalScope.variables.set(node.name, value)
  }

  private executeBlock(node: BlockStmtNode): void {
    const scope = createScope(this.globalScope)
    const oldScope = this.globalScope
    this.globalScope = scope

    try {
      for (const stmt of node.statements) {
        this.execute(stmt)
      }
    } finally {
      this.globalScope = oldScope
    }
  }

  private executeIf(node: IfStmtNode): void {
    const condition = this.eval(node.condition)
    if (isTruthy(condition)) {
      this.execute(node.consequent)
    } else if (node.alternate) {
      this.execute(node.alternate)
    }
  }

  private executeWhile(node: WhileStmtNode): void {
    while (true) {
      this.checkTimeout()
      const condition = this.eval(node.condition)
      if (!isTruthy(condition)) break
      try {
        this.execute(node.body)
      } catch (e) {
        if (e instanceof BreakSignal) break
        if (e instanceof ContinueSignal) continue
        throw e
      }
    }
  }

  private executeDoWhile(node: DoWhileStmtNode): void {
    while (true) {
      this.checkTimeout()
      try {
        this.execute(node.body)
      } catch (e) {
        if (e instanceof BreakSignal) break
        if (e instanceof ContinueSignal) {
          const condition = this.eval(node.condition)
          if (!isTruthy(condition)) break
          continue
        }
        throw e
      }
      const condition = this.eval(node.condition)
      if (!isTruthy(condition)) break
    }
  }

  private executeFor(node: ForStmtNode): void {
    const scope = createScope(this.globalScope)
    const oldScope = this.globalScope
    this.globalScope = scope

    try {
      if (node.init) {
        this.execute(node.init)
      }

      while (true) {
        this.checkTimeout()
        if (node.condition) {
          const condition = this.eval(node.condition)
          if (!isTruthy(condition)) break
        }

        try {
          this.execute(node.body)
        } catch (e) {
          if (e instanceof BreakSignal) break
          if (e instanceof ContinueSignal) {
            if (node.update) this.eval(node.update)
            continue
          }
          throw e
        }

        if (node.update) {
          this.eval(node.update)
        }
      }
    } finally {
      this.globalScope = oldScope
    }
  }

  private executeSwitch(node: SwitchStmtNode): void {
    const switchValue = this.eval(node.expression)

    let matched: CaseStmtNode | undefined
    let foundMatch = false

    for (const cs of node.cases) {
      if (!foundMatch) {
        if (cs.value) {
          const caseValue = this.eval(cs.value)
          if (valuesEqual(switchValue, caseValue)) {
            matched = cs
            foundMatch = true
          }
        }
        // 没找到匹配的 case 值，记录 default（如果存在）
        if (!foundMatch && !cs.value && !node.defaultCase) {
          node.defaultCase = cs
        }
      }
    }

    if (!matched && node.defaultCase) {
      matched = node.defaultCase
    }

    if (matched) {
      // 从匹配的 case 开始执行，后续 case 会 fall through（C++ 语义）
      // 但我们需要拦截 BreakSignal
      const matchedIdx = node.cases.indexOf(matched)
      try {
        for (let i = matchedIdx; i < node.cases.length; i++) {
          for (const stmt of node.cases[i].statements) {
            this.execute(stmt)
          }
        }
      } catch (e) {
        if (e instanceof BreakSignal) {
          // break 跳出 switch
        } else {
          throw e
        }
      }
    } else if (node.defaultCase) {
      try {
        for (const stmt of node.defaultCase.statements) {
          this.execute(stmt)
        }
      } catch (e) {
        if (e instanceof BreakSignal) {
          // break 跳出 switch
        } else {
          throw e
        }
      }
    }
  }

  // ─── 表达式求值 ──────────────────────────────────────────────────────

  eval(node: ASTNode): CppValue {
    this.checkTimeout()

    switch (node.type) {
      case 'NumberLiteral':
        return (node as NumberLiteralNode).value
      case 'FloatLiteral':
        return (node as FloatLiteralNode).value
      case 'CharLiteral':
        return { type: 'char', value: (node as CharLiteralNode).value }
      case 'StringLiteral':
        return (node as StringLiteralNode).value
      case 'BoolLiteral':
        return (node as BoolLiteralNode).value
      case 'Identifier': {
        const name = (node as IdentifierNode).name
        const result = lookupVariable(this.globalScope, name)
        if (result) return result.value
        return 0
      }
      case 'BinaryExpr':
        return this.evalBinary(node as BinaryExprNode)
      case 'UnaryExpr':
        return this.evalUnary(node as UnaryExprNode)
      case 'CallExpr':
        return this.evalCall(node as CallExprNode)
      case 'IndexExpr': {
        const indexNode = node as IndexExprNode
        const arr = this.eval(indexNode.array)
        const idx = this.eval(indexNode.index)
        if (arr && (arr as CppArray).type === 'array') {
          return (arr as CppArray).data[idx as number] ?? 0
        }
        return 0
      }
      case 'MemberExpr':
        return this.evalMember(node as MemberExprNode)
      case 'TernaryExpr': {
        const ternary = node as TernaryExprNode
        const cond = this.eval(ternary.condition)
        return isTruthy(cond) ? this.eval(ternary.consequent) : this.eval(ternary.alternate)
      }
      case 'ArrayInitExpr': {
        const arrNode = node as ArrayInitExprNode
        const elements: CppValue[] = arrNode.elements.map(el => this.eval(el))
        return { type: 'array', data: elements }
      }
      case 'AssignExpr':
        return this.evalAssign(node as AssignExprNode)
      case 'CStyleCast': {
        const cast = node as CStyleCastNode
        const val = this.eval(cast.operand)
        switch (cast.castType) {
          case 'int':
            return typeof val === 'number' ? Math.trunc(val) : (isCppObject(val) && val.type === 'char' ? (val as CppChar).value : 0)
          case 'double':
          case 'float':
            return typeof val === 'number' ? val : (isCppObject(val) && val.type === 'char' ? (val as CppChar).value : 0)
          case 'char':
            if (typeof val === 'number') return { type: 'char', value: Math.trunc(val) } as CppChar
            return val
          case 'bool':
            return isTruthy(val)
          default:
            return val
        }
      }
      default:
        return 0
    }
  }

  private evalBinary(node: BinaryExprNode): CppValue {
    const left = this.eval(node.left)
    // 特殊处理: cin >> var（右操作数需先解析变量名，从 stdin 读取）
    if (left === '__CIN__' && node.operator === '>>') {
      if (node.right.type === 'Identifier') {
        const name = (node.right as IdentifierNode).name
        const inputVal = this.stdinBuffer.shift()
        const numVal = parseInt(inputVal || '0', 10) || 0
        this.globalScope.variables.set(name, numVal)
      }
      return '__CIN__'
    }
    const right = this.eval(node.right)

    switch (node.operator) {
      case '+':
        if (typeof left === 'string' || typeof right === 'string') {
          return String(left) + String(right)
        }
        return (left as number) + (right as number)
      case '-': return (left as number) - (right as number)
      case '*': return (left as number) * (right as number)
      case '/': return safeDiv(left, right)
      case '%': return safeMod(left, right)
      case '==': return valuesEqual(left, right)
      case '!=': return !valuesEqual(left, right)
      case '<': return (left as number) < (right as number)
      case '>': return (left as number) > (right as number)
      case '<=': return (left as number) <= (right as number)
      case '>=': return (left as number) >= (right as number)
      case '&&': return isTruthy(left) && isTruthy(right)
      case '||': return isTruthy(left) || isTruthy(right)
      case '&': return (left as number) & (right as number)
      case '|': return (left as number) | (right as number)
      case '^': return (left as number) ^ (right as number)
      case '<<':
        // 流输出: cout << value
        if (left === STREAM_MARKER) {
          this.print(right)
          return STREAM_MARKER
        }
        return (left as number) << (right as number)
      case '>>':
        return (left as number) >> (right as number)
      default: return 0
    }
  }

  private evalUnary(node: UnaryExprNode): CppValue {
    const val = this.eval(node.operand)

    switch (node.operator) {
      case '!': return !isTruthy(val)
      case '~': return ~(val as number)
      case '-': return -(val as number)
      case '+': return +(val as number)
      case '&': return (val as number)
      case '*': return val
      case '++': {
        // ++i 或 i++ — 修改变量值
        const operand = node.operand
        if (operand.type === 'Identifier') {
          const name = (operand as IdentifierNode).name
          const newVal = (val as number) + 1
          setVariable(this.globalScope, name, newVal)
          return newVal
        }
        return (val as number) + 1
      }
      case '--': {
        // --i 或 i-- — 修改变量值
        const operand = node.operand
        if (operand.type === 'Identifier') {
          const name = (operand as IdentifierNode).name
          const newVal = (val as number) - 1
          setVariable(this.globalScope, name, newVal)
          return newVal
        }
        return (val as number) - 1
      }
      default: return val
    }
  }

  private evalCall(node: CallExprNode): CppValue {
    // 标准库函数
    if (node.callee in builtinFunctions) {
      const args = node.args.map(a => this.eval(a))
      return builtinFunctions[node.callee](...args)
    }

    // 用户定义函数
    const func = this.functions.get(node.callee)
    if (!func) {
      this.stderr += `未定义的函数: ${node.callee}\n`
      return 0
    }

    const scope = createScope(this.globalScope)
    const oldScope = this.globalScope
    this.globalScope = scope
    this.callStack.push({ name: func.name, line: func.line })

    try {
      // 绑定参数
      for (let i = 0; i < func.params.length && i < node.args.length; i++) {
        const param = func.params[i]
        const argValue = this.eval(node.args[i])
        scope.variables.set(param.name, argValue)
      }

      // 执行函数体
      const body = func.body
      let result: CppValue = 0
      try {
        for (const stmt of body.statements) {
          this.execute(stmt)
        }
      } catch (e) {
        if (e instanceof ReturnSignal) {
          result = e.value
        } else {
          throw e
        }
      }
      return result
    } finally {
      this.callStack.pop()
      this.globalScope = oldScope
    }
  }

  private evalMember(node: MemberExprNode): CppValue {
    const obj = this.eval(node.object)
    if (node.member === 'size') {
      if (obj && (obj as CppArray).type === 'array') {
        return (obj as CppArray).data.length
      }
    }
    return obj
  }

  private evalAssign(node: AssignExprNode): CppValue {
    const target = node.target
    const value = this.eval(node.value)

    if (target.type === 'Identifier') {
      const name = (target as IdentifierNode).name
      let newValue: CppValue = value

      if (node.operator !== '=') {
        const existing = lookupVariable(this.globalScope, name)
        const currentVal = existing ? existing.value : 0
        switch (node.operator) {
          case '+=': newValue = (currentVal as number) + (value as number); break
          case '-=': newValue = (currentVal as number) - (value as number); break
          case '*=': newValue = (currentVal as number) * (value as number); break
          case '/=': newValue = (currentVal as number) / (value as number); break
          case '%=': newValue = (currentVal as number) % (value as number); break
          case '&=': newValue = (currentVal as number) & (value as number); break
          case '|=': newValue = (currentVal as number) | (value as number); break
          case '^=': newValue = (currentVal as number) ^ (value as number); break
          default: newValue = value
        }
      }

      setVariable(this.globalScope, name, newValue)
      return newValue
    }

    if (target.type === 'IndexExpr') {
      const indexNode = target as IndexExprNode
      const arr = this.eval(indexNode.array)
      const idx = this.eval(indexNode.index)
      if (arr && (arr as CppArray).type === 'array') {
        let newValue: CppValue = value
        if (node.operator !== '=') {
          const currentVal = (arr as CppArray).data[idx as number] ?? 0
          switch (node.operator) {
            case '+=': newValue = (currentVal as number) + (value as number); break
            case '-=': newValue = (currentVal as number) - (value as number); break
            case '*=': newValue = (currentVal as number) * (value as number); break
            case '/=': newValue = (currentVal as number) / (value as number); break
            case '%=': newValue = (currentVal as number) % (value as number); break
            case '&=': newValue = (currentVal as number) & (value as number); break
            case '|=': newValue = (currentVal as number) | (value as number); break
            case '^=': newValue = (currentVal as number) ^ (value as number); break
            default: newValue = value
          }
        }
        ;(arr as CppArray).data[idx as number] = newValue
        return newValue
      }
      return value
    }

    if (target.type === 'MemberExpr') {
      const memberNode = target as MemberExprNode
      const obj = this.eval(memberNode.object)
      if (obj && isCppObject(obj) && obj.type === 'array') {
        const idx = parseInt(memberNode.member, 10)
        let newValue: CppValue = value
        if (node.operator !== '=') {
          const currentVal = (obj as CppArray).data[idx] ?? 0
          switch (node.operator) {
            case '+=': newValue = (currentVal as number) + (value as number); break
            case '-=': newValue = (currentVal as number) - (value as number); break
            case '*=': newValue = (currentVal as number) * (value as number); break
            case '/=': newValue = (currentVal as number) / (value as number); break
            case '%=': newValue = (currentVal as number) % (value as number); break
            case '&=': newValue = (currentVal as number) & (value as number); break
            case '|=': newValue = (currentVal as number) | (value as number); break
            case '^=': newValue = (currentVal as number) ^ (value as number); break
            default: newValue = value
          }
        }
        ;(obj as CppArray).data[idx] = newValue
        return newValue
      }
      return value
    }

    return value
  }
}

export function createInterpreter(): Interpreter {
  return new Interpreter()
}