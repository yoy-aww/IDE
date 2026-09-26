// ─── 语法分析器 ───────────────────────────────────────────────────────
// 将 Token 流转换为抽象语法树 (AST)

import type { Token } from './lexer'

// ─── AST 节点定义 ────────────────────────────────────────────────────

interface BaseNode {
  type: string
  line: number
  col: number
}

export interface ProgramNode extends BaseNode {
  type: 'Program'
  declarations: ASTNode[]
}

export interface FunctionDeclNode extends BaseNode {
  type: 'FunctionDecl'
  name: string
  params: ParamDeclNode[]
  returnType: string
  body: BlockStmtNode
}

export interface ParamDeclNode extends BaseNode {
  type: 'ParamDecl'
  name: string
  paramType: string
  isPointer: boolean
}

export interface VarDeclNode extends BaseNode {
  type: 'VarDecl'
  name: string
  varType: string
  isArray: boolean
  arraySize?: number
  isPointer: boolean
  initializer?: ASTNode
}

export interface BlockStmtNode extends BaseNode {
  type: 'BlockStmt'
  statements: ASTNode[]
}

export interface IfStmtNode extends BaseNode {
  type: 'IfStmt'
  condition: ASTNode
  consequent: ASTNode
  alternate?: ASTNode
}

export interface WhileStmtNode extends BaseNode {
  type: 'WhileStmt'
  condition: ASTNode
  body: ASTNode
}

export interface DoWhileStmtNode extends BaseNode {
  type: 'DoWhileStmt'
  condition: ASTNode
  body: ASTNode
}

export interface ForStmtNode extends BaseNode {
  type: 'ForStmt'
  init?: ASTNode
  condition?: ASTNode
  update?: ASTNode
  body: ASTNode
}

export interface SwitchStmtNode extends BaseNode {
  type: 'SwitchStmt'
  expression: ASTNode
  cases: CaseStmtNode[]
  defaultCase?: CaseStmtNode
}

export interface CaseStmtNode extends BaseNode {
  type: 'CaseStmt'
  value?: ASTNode
  statements: ASTNode[]
}

export interface ReturnStmtNode extends BaseNode {
  type: 'ReturnStmt'
  value?: ASTNode
}

export interface ExprStmtNode extends BaseNode {
  type: 'ExprStmt'
  expression: ASTNode
}

export interface BinaryExprNode extends BaseNode {
  type: 'BinaryExpr'
  operator: string
  left: ASTNode
  right: ASTNode
}

export interface UnaryExprNode extends BaseNode {
  type: 'UnaryExpr'
  operator: string
  operand: ASTNode
}

export interface CallExprNode extends BaseNode {
  type: 'CallExpr'
  callee: string
  args: ASTNode[]
}

export interface MemberExprNode extends BaseNode {
  type: 'MemberExpr'
  object: ASTNode
  member: string
}

export interface IndexExprNode extends BaseNode {
  type: 'IndexExpr'
  array: ASTNode
  index: ASTNode
}

export interface TernaryExprNode extends BaseNode {
  type: 'TernaryExpr'
  condition: ASTNode
  consequent: ASTNode
  alternate: ASTNode
}

export interface AssignExprNode extends BaseNode {
  type: 'AssignExpr'
  target: ASTNode
  operator: string
  value: ASTNode
}

export interface ArrayInitExprNode extends BaseNode {
  type: 'ArrayInitExpr'
  elements: ASTNode[]
}

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral'
  value: number
}

export interface FloatLiteralNode extends BaseNode {
  type: 'FloatLiteral'
  value: number
}

export interface CharLiteralNode extends BaseNode {
  type: 'CharLiteral'
  value: number
}

export interface StringLiteralNode extends BaseNode {
  type: 'StringLiteral'
  value: string
}

export interface BoolLiteralNode extends BaseNode {
  type: 'BoolLiteral'
  value: boolean
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier'
  name: string
}

export type ASTNode =
  | ProgramNode
  | FunctionDeclNode
  | ParamDeclNode
  | VarDeclNode
  | BlockStmtNode
  | IfStmtNode
  | WhileStmtNode
  | DoWhileStmtNode
  | ForStmtNode
  | SwitchStmtNode
  | CaseStmtNode
  | ReturnStmtNode
  | ExprStmtNode
  | BinaryExprNode
  | UnaryExprNode
  | CallExprNode
  | MemberExprNode
  | IndexExprNode
  | TernaryExprNode
  | AssignExprNode
  | ArrayInitExprNode
  | NumberLiteralNode
  | FloatLiteralNode
  | CharLiteralNode
  | StringLiteralNode
  | BoolLiteralNode
  | IdentifierNode

// ─── 语法分析器 ───────────────────────────────────────────────────────

export class Parser {
  private tokens: Token[]
  private pos: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
    this.pos = 0
  }

  parse(): ProgramNode {
    const declarations: ASTNode[] = []
    while (!this.isAtEnd()) {
      declarations.push(this.parseDeclaration())
    }
    return { type: 'Program', line: 1, col: 1, declarations }
  }

  private peek(offset = 0): Token {
    const idx = Math.min(this.pos + offset, this.tokens.length - 1)
    return this.tokens[idx]
  }

  private advance(): Token {
    const tok = this.tokens[this.pos]
    if (this.pos < this.tokens.length - 1) this.pos++
    return tok
  }

  private isAtEnd(): boolean {
    return this.peek().type === 'EndOfInput'
  }

  private check(type: string, value?: string): boolean {
    const tok = this.peek()
    if (tok.type !== type) return false
    if (value !== undefined && tok.value !== value) return false
    return true
  }

  private match(type: string, value?: string): boolean {
    if (this.check(type, value)) {
      this.advance()
      return true
    }
    return false
  }

  private expect(type: string, value?: string): Token {
    const tok = this.peek()
    if (tok.type !== type || (value !== undefined && tok.value !== value)) {
      throw new SyntaxError(
        `${tok.line}:${tok.col} 期望 ${value || type}，实际得到 "${tok.value}"`
      )
    }
    return this.advance()
  }

  private isKeyword(value: string): boolean {
    return this.check('Keyword', value)
  }

  private isIdentifier(): boolean {
    return this.check('Identifier')
  }

  // ─── 声明解析 ──────────────────────────────────────────────────────

  private parseDeclaration(): ASTNode {
    if (this.isKeyword('include')) {
      while (!this.isAtEnd() && !this.check('Punctuation', ';') && !this.check('Keyword', 'int') && !this.check('Keyword', 'void') && !this.check('Identifier')) {
        this.advance()
      }
      return { type: 'VarDecl', line: this.peek().line, col: this.peek().col, name: '_skip', varType: 'void', isArray: false, isPointer: false }
    }

    if (this.isKeyword('using')) {
      this.advance()
      while (!this.isAtEnd() && !this.check('Punctuation', ';')) {
        this.advance()
      }
      this.expect('Punctuation', ';')
      return { type: 'VarDecl', line: this.peek().line, col: this.peek().col, name: '_skip', varType: 'void', isArray: false, isPointer: false }
    }

    if (this.check('Keyword', 'int') || this.check('Keyword', 'void') || this.check('Keyword', 'double') || this.check('Keyword', 'float') || this.check('Keyword', 'char')) {
      const returnType = this.advance().value
      if (this.isIdentifier() && this.peek(1).value === '(') {
        return this.parseFunctionDecl(returnType)
      }
      return this.parseVarDecl(returnType)
    }

    if (this.check('Keyword')) {
      const tok = this.advance()
      if (this.isIdentifier() && this.peek(1).value === '(') {
        return this.parseFunctionDecl(tok.value)
      }
      if (this.isIdentifier()) {
        return this.parseVarDecl(tok.value)
      }
    }

    const stmt = this.parseStatement()
    if (stmt) return stmt

    this.advance()
    return { type: 'VarDecl', line: this.peek().line, col: this.peek().col, name: '_skip', varType: 'void', isArray: false, isPointer: false }
  }

  private parseFunctionDecl(returnType: string): FunctionDeclNode {
    const startTok = this.peek()
    const name = this.expect('Identifier').value
    this.expect('Punctuation', '(')

    const params: ParamDeclNode[] = []
    if (!this.check('Punctuation', ')')) {
      params.push(this.parseParam())
      while (this.match('Punctuation', ',')) {
        params.push(this.parseParam())
      }
    }
    this.expect('Punctuation', ')')

    const body = this.parseBlock()

    return {
      type: 'FunctionDecl',
      line: startTok.line,
      col: startTok.col,
      name,
      params,
      returnType,
      body,
    }
  }

  private parseParam(): ParamDeclNode {
    const startTok = this.peek()
    let paramType = this.advance().value
    let isPointer = false
    while (this.check('Operator', '*')) {
      isPointer = true
      this.advance()
    }
    while (this.isKeyword('const')) {
      this.advance()
    }
    const name = this.expect('Identifier').value
    return {
      type: 'ParamDecl',
      line: startTok.line,
      col: startTok.col,
      name,
      paramType,
      isPointer,
    }
  }

  private parseVarDecl(varType: string): VarDeclNode {
    const startTok = this.peek()
    let isPointer = false
    let isArray = false
    let arraySize: number | undefined

    if (this.check('Operator', '*')) {
      isPointer = true
      this.advance()
    }
    while (this.isKeyword('const')) {
      this.advance()
    }

    const name = this.expect('Identifier').value

    if (this.check('Punctuation', '[')) {
      isArray = true
      this.advance()
      const sizeTok = this.advance()
      arraySize = parseInt(sizeTok.value, 10)
      this.expect('Punctuation', ']')
    }

    let initializer: ASTNode | undefined
    if (this.match('Operator', '=')) {
      // 数组初始化列表: {5, 3, 1, 4, 2}
      if (this.check('Punctuation', '{')) {
        initializer = this.parseArrayInit()
      } else {
        initializer = this.parseExpression()
      }
    }

    this.expect('Punctuation', ';')

    return {
      type: 'VarDecl',
      line: startTok.line,
      col: startTok.col,
      name,
      varType,
      isArray,
      arraySize,
      isPointer,
      initializer,
    }
  }

  private parseArrayInit(): ASTNode {
    const startTok = this.advance() // '{'
    const elements: ASTNode[] = []
    while (!this.check('Punctuation', '}') && !this.isAtEnd()) {
      elements.push(this.parseExpression())
      if (this.match('Punctuation', ',')) continue
      break
    }
    this.expect('Punctuation', '}')
    return { type: 'ArrayInitExpr', line: startTok.line, col: startTok.col, elements }
  }

  // ─── 语句解析 ──────────────────────────────────────────────────────

  private parseStatement(): ASTNode | undefined {
    if (this.check('Punctuation', '{')) {
      return this.parseBlock()
    }

    if (this.isKeyword('if')) {
      return this.parseIf()
    }

    if (this.isKeyword('while')) {
      return this.parseWhile()
    }

    if (this.isKeyword('do')) {
      return this.parseDoWhile()
    }

    if (this.isKeyword('for')) {
      return this.parseFor()
    }

    if (this.isKeyword('switch')) {
      return this.parseSwitch()
    }

    if (this.isKeyword('case')) {
      return this.parseCase()
    }

    if (this.isKeyword('default')) {
      return this.parseDefaultCase()
    }

    if (this.isKeyword('return')) {
      return this.parseReturn()
    }

    if (this.isKeyword('break') || this.isKeyword('continue')) {
      const tok = this.advance()
      this.expect('Punctuation', ';')
      return { type: 'ExprStmt', line: tok.line, col: tok.col, expression: { type: 'Identifier', line: tok.line, col: tok.col, name: tok.value } }
    }

    if (this.check('Keyword', 'int') || this.check('Keyword', 'double') || this.check('Keyword', 'float') || this.check('Keyword', 'char') || this.check('Keyword', 'bool')) {
      const varType = this.advance().value
      return this.parseVarDecl(varType)
    }

    const expr = this.parseExpression()
    if (expr) {
      this.expect('Punctuation', ';')
      return { type: 'ExprStmt', line: expr.line, col: expr.col, expression: expr }
    }

    this.advance()
    return undefined
  }

  private parseBlock(): BlockStmtNode {
    const startTok = this.peek()
    this.expect('Punctuation', '{')
    const statements: ASTNode[] = []
    while (!this.check('Punctuation', '}') && !this.isAtEnd()) {
      const stmt = this.parseStatement()
      if (stmt) statements.push(stmt)
    }
    this.expect('Punctuation', '}')
    return {
      type: 'BlockStmt',
      line: startTok.line,
      col: startTok.col,
      statements,
    }
  }

  private parseIf(): IfStmtNode {
    const startTok = this.advance()
    this.expect('Punctuation', '(')
    const condition = this.parseExpression()
    this.expect('Punctuation', ')')
    const consequent = this.parseStatement()
    let alternate: ASTNode | undefined
    if (this.isKeyword('else')) {
      this.advance()
      alternate = this.parseStatement()
    }
    return {
      type: 'IfStmt',
      line: startTok.line,
      col: startTok.col,
      condition,
      consequent: consequent!,
      alternate,
    }
  }

  private parseWhile(): WhileStmtNode {
    const startTok = this.advance()
    this.expect('Punctuation', '(')
    const condition = this.parseExpression()
    this.expect('Punctuation', ')')
    const body = this.parseStatement()
    return {
      type: 'WhileStmt',
      line: startTok.line,
      col: startTok.col,
      condition,
      body: body!,
    }
  }

  private parseDoWhile(): DoWhileStmtNode {
    const startTok = this.advance()
    const body = this.parseStatement()
    this.expect('Keyword', 'while')
    this.expect('Punctuation', '(')
    const condition = this.parseExpression()
    this.expect('Punctuation', ')')
    this.expect('Punctuation', ';')
    return {
      type: 'DoWhileStmt',
      line: startTok.line,
      col: startTok.col,
      condition,
      body: body!,
    }
  }

  private parseFor(): ForStmtNode {
    const startTok = this.advance()
    this.expect('Punctuation', '(')

    let init: ASTNode | undefined
    if (!this.check('Punctuation', ';')) {
      if (this.check('Keyword', 'int') || this.check('Keyword', 'double') || this.check('Keyword', 'float') || this.check('Keyword', 'char')) {
        const varType = this.advance().value
        init = this.parseVarDecl(varType)
      } else {
        init = this.parseExpression()
        this.expect('Punctuation', ';')
      }
    } else {
      this.expect('Punctuation', ';')
    }

    let condition: ASTNode | undefined
    if (!this.check('Punctuation', ';')) {
      condition = this.parseExpression()
    }
    this.expect('Punctuation', ';')

    let update: ASTNode | undefined
    if (!this.check('Punctuation', ')')) {
      update = this.parseExpression()
    }
    this.expect('Punctuation', ')')

    const body = this.parseStatement()
    return {
      type: 'ForStmt',
      line: startTok.line,
      col: startTok.col,
      init,
      condition,
      update,
      body: body!,
    }
  }

  private parseSwitch(): SwitchStmtNode {
    const startTok = this.advance()
    this.expect('Punctuation', '(')
    const expression = this.parseExpression()
    this.expect('Punctuation', ')')
    this.expect('Punctuation', '{')

    const cases: CaseStmtNode[] = []
    let defaultCase: CaseStmtNode | undefined

    while (!this.check('Punctuation', '}') && !this.isAtEnd()) {
      if (this.isKeyword('case')) {
        const caseNode = this.parseCase()
        cases.push(caseNode)
      } else if (this.isKeyword('default')) {
        defaultCase = this.parseDefaultCase()
      } else if (this.check('Punctuation', '}')) {
        break
      } else {
        this.advance()
      }
    }
    this.expect('Punctuation', '}')

    return {
      type: 'SwitchStmt',
      line: startTok.line,
      col: startTok.col,
      expression,
      cases,
      defaultCase,
    }
  }

  private parseCase(): CaseStmtNode {
    const startTok = this.advance()
    const value = this.parseExpression()
    this.expect('Punctuation', ':')
    const statements: ASTNode[] = []
    while (!this.check('Keyword', 'case') && !this.isKeyword('default') && !this.check('Punctuation', '}') && !this.isAtEnd()) {
      const stmt = this.parseStatement()
      if (stmt) statements.push(stmt)
    }
    return {
      type: 'CaseStmt',
      line: startTok.line,
      col: startTok.col,
      value,
      statements,
    }
  }

  private parseDefaultCase(): CaseStmtNode {
    const startTok = this.advance()
    this.expect('Punctuation', ':')
    const statements: ASTNode[] = []
    while (!this.check('Keyword', 'case') && !this.isKeyword('default') && !this.check('Punctuation', '}') && !this.isAtEnd()) {
      const stmt = this.parseStatement()
      if (stmt) statements.push(stmt)
    }
    return {
      type: 'CaseStmt',
      line: startTok.line,
      col: startTok.col,
      value: undefined,
      statements,
    }
  }

  private parseReturn(): ReturnStmtNode {
    const startTok = this.advance()
    let value: ASTNode | undefined
    if (!this.check('Punctuation', ';')) {
      value = this.parseExpression()
    }
    this.expect('Punctuation', ';')
    return {
      type: 'ReturnStmt',
      line: startTok.line,
      col: startTok.col,
      value,
    }
  }

  // ─── 表达式解析（运算符优先级递增） ──────────────────────────────────

  private parseExpression(): ASTNode {
    return this.parseTernary()
  }

  private parseTernary(): ASTNode {
    const cond = this.parseAssignment()
    if (this.match('Operator', '?')) {
      const consequent = this.parseExpression()
      this.expect('Punctuation', ':')
      const alternate = this.parseTernary()
      return { type: 'TernaryExpr', line: cond.line, col: cond.col, condition: cond, consequent, alternate }
    }
    return cond
  }

  private parseAssignment(): ASTNode {
    const left = this.parseOr()
    if (this.check('Operator', '=') || this.check('Operator', '+=') || this.check('Operator', '-=') ||
        this.check('Operator', '*=') || this.check('Operator', '/=') || this.check('Operator', '%=') ||
        this.check('Operator', '&=') || this.check('Operator', '|=') || this.check('Operator', '^=')) {
      const op = this.advance()
      const right = this.parseAssignment()
      return { type: 'AssignExpr', line: left.line, col: left.col, target: left, operator: op.value, value: right }
    }
    return left
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd()
    while (this.check('Operator', '||')) {
      const op = this.advance()
      const right = this.parseAnd()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality()
    while (this.check('Operator', '&&')) {
      const op = this.advance()
      const right = this.parseEquality()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseEquality(): ASTNode {
    let left = this.parseRelational()
    while (this.check('Operator', '==') || this.check('Operator', '!=')) {
      const op = this.advance()
      const right = this.parseRelational()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseRelational(): ASTNode {
    let left = this.parseShift()
    while (this.check('Operator', '<') || this.check('Operator', '>') || this.check('Operator', '<=') || this.check('Operator', '>=')) {
      const op = this.advance()
      const right = this.parseShift()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseShift(): ASTNode {
    let left = this.parseAdditive()
    while (this.check('Operator', '<<') || this.check('Operator', '>>')) {
      const op = this.advance()
      const right = this.parseAdditive()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative()
    while (this.check('Operator', '+') || this.check('Operator', '-')) {
      const op = this.advance()
      const right = this.parseMultiplicative()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parseUnary()
    while (this.check('Operator', '*') || this.check('Operator', '/') || this.check('Operator', '%')) {
      const op = this.advance()
      const right = this.parseUnary()
      left = { type: 'BinaryExpr', line: left.line, col: left.col, operator: op.value, left, right }
    }
    return left
  }

  private parseUnary(): ASTNode {
    // C 风格强制转换: (int)expr, (double)expr, (char)expr, etc.
    if (this.check('Punctuation', '(')) {
      const paren = this.peek()
      // Look ahead: ( type )
      const save = this.pos
      this.advance()  // consume '('
      if (this.peek().type === 'Keyword') {
        const typeName = this.peek().value
        if (['int', 'double', 'float', 'char', 'bool', 'long', 'short', 'unsigned'].includes(typeName)) {
          this.advance()  // consume type keyword
          if (this.check('Punctuation', ')')) {
            this.advance()  // consume ')'
            const operand = this.parseUnary()
            return { type: 'CStyleCast', line: paren.line, col: paren.col, castType: typeName, operand } as ASTNode
          }
        }
      }
      this.pos = save  // restore
    }

    if (this.check('Operator', '!') || this.check('Operator', '~') || this.check('Operator', '-') || this.check('Operator', '+')) {
      const op = this.advance()
      const operand = this.parseUnary()
      return { type: 'UnaryExpr', line: op.line, col: op.col, operator: op.value, operand }
    }
    if (this.check('Operator', '&')) {
      const op = this.advance()
      const operand = this.parseUnary()
      return { type: 'UnaryExpr', line: op.line, col: op.col, operator: '&', operand }
    }
    if (this.check('Operator', '*')) {
      const op = this.advance()
      const operand = this.parseUnary()
      return { type: 'UnaryExpr', line: op.line, col: op.col, operator: '*', operand }
    }
    if (this.check('Operator', '++') || this.check('Operator', '--')) {
      const op = this.advance()
      const operand = this.parseUnary()
      return { type: 'UnaryExpr', line: op.line, col: op.col, operator: op.value, operand }
    }
    return this.parsePostfix()
  }

  private parsePostfix(): ASTNode {
    let expr = this.parsePrimary()

    while (true) {
      if (this.check('Punctuation', '(')) {
        this.advance()
        const args: ASTNode[] = []
        if (!this.check('Punctuation', ')')) {
          args.push(this.parseExpression())
          while (this.match('Punctuation', ',')) {
            args.push(this.parseExpression())
          }
        }
        this.expect('Punctuation', ')')
        expr = {
          type: 'CallExpr',
          line: expr.line,
          col: expr.col,
          callee: expr.type === 'Identifier' ? (expr as IdentifierNode).name : 'unknown',
          args,
        }
      }
      else if (this.check('Punctuation', '[')) {
        this.advance()
        const index = this.parseExpression()
        this.expect('Punctuation', ']')
        expr = { type: 'IndexExpr', line: expr.line, col: expr.col, array: expr, index }
      }
      else if (this.check('Punctuation', '.')) {
        this.advance()
        const member = this.expect('Identifier').value
        expr = { type: 'MemberExpr', line: expr.line, col: expr.col, object: expr, member }
      }
      else if (this.check('Operator', '++') || this.check('Operator', '--')) {
        const op = this.advance()
        expr = { type: 'UnaryExpr', line: expr.line, col: expr.col, operator: op.value, operand: expr }
      }
      else break
    }

    return expr
  }

  private parsePrimary(): ASTNode {
    const tok = this.peek()

    if (tok.type === 'Number') {
      this.advance()
      return { type: 'NumberLiteral', line: tok.line, col: tok.col, value: parseInt(tok.value, 10) }
    }

    if (tok.type === 'Float') {
      this.advance()
      return { type: 'FloatLiteral', line: tok.line, col: tok.col, value: parseFloat(tok.value) }
    }

    if (tok.type === 'Char') {
      this.advance()
      return { type: 'CharLiteral', line: tok.line, col: tok.col, value: tok.value.charCodeAt(0) }
    }

    if (tok.type === 'String') {
      this.advance()
      return { type: 'StringLiteral', line: tok.line, col: tok.col, value: tok.value }
    }

    if (tok.type === 'Keyword' && (tok.value === 'true' || tok.value === 'false')) {
      this.advance()
      return { type: 'BoolLiteral', line: tok.line, col: tok.col, value: tok.value === 'true' }
    }

    if (tok.type === 'Identifier') {
      this.advance()
      return { type: 'Identifier', line: tok.line, col: tok.col, name: tok.value }
    }

    if (this.check('Punctuation', '(')) {
      this.advance()
      const expr = this.parseExpression()
      this.expect('Punctuation', ')')
      return expr
    }

    throw new SyntaxError(`${tok.line}:${tok.col} 意外的 token "${tok.value}"`)
  }
}
