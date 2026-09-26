// ─── 词法分析器 ───────────────────────────────────────────────────────
// 将 C++ 源码拆分为 Token 流

export type TokenType =
  | 'Number'
  | 'Float'
  | 'Char'
  | 'String'
  | 'Identifier'
  | 'Keyword'
  | 'Operator'
  | 'Punctuation'
  | 'Preprocessor'
  | 'EndOfInput'

export interface Token {
  type: TokenType
  value: string
  line: number
  col: number
}

// C++ 关键字列表
const KEYWORDS = new Set([
  // 类型
  'void', 'int', 'float', 'double', 'char', 'bool', 'long', 'short',
  'signed', 'unsigned', 'auto',
  // 控制流
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return',
  // 其他
  'class', 'struct', 'union', 'enum', 'typedef',
  'namespace', 'using', 'template', 'typename',
  'public', 'private', 'protected',
  'const', 'static', 'inline', 'virtual', 'override',
  'true', 'false', 'nullptr', 'this',
  // 注意: cout/cin/endl/iostream 不放在 KEYWORDS 里，
  // 因为它们需要在表达式中作为标识符使用
  // (cout << "Hello" << endl;)
])

// 运算符映射
const OPERATORS = new Set([
  '+', '-', '*', '/', '%',
  '++', '--',
  '=', '==', '!=', '<', '>', '<=', '>=',
  '&&', '||', '!',
  '&', '|', '^', '~',
  '<<', '>>',
  '+=', '-=', '*=', '/=', '%=',
  '&=', '|=', '^=',
  '<<=', '>>=',
  '?',
])

export function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let pos = 0
  let line = 1
  let col = 1

  while (pos < source.length) {
    const ch = source[pos]

    // 跳过空白
    if (ch === ' ' || ch === '\t' || ch === '\r') {
      pos++
      col++
      continue
    }

    if (ch === '\n') {
      pos++
      line++
      col = 1
      continue
    }

    // 预处理指令 #include
    if (ch === '#') {
      const startCol = col
      pos++
      col++
      // 跳过空白
      while (pos < source.length && (source[pos] === ' ' || source[pos] === '\t')) {
        pos++
        col++
      }
      // 读取指令名
      let name = ''
      while (pos < source.length && /[a-zA-Z_]/.test(source[pos])) {
        name += source[pos]
        pos++
        col++
      }
      tokens.push({ type: 'Keyword', value: name, line, col: startCol })
      // 读取剩余部分（头文件名等）
      while (pos < source.length && source[pos] !== '\n') {
        pos++
        col++
      }
      continue
    }

    // 注释 //
    if (ch === '/' && pos + 1 < source.length && source[pos + 1] === '/') {
      while (pos < source.length && source[pos] !== '\n') {
        pos++
        col++
      }
      continue
    }

    // 注释 /* */
    if (ch === '/' && pos + 1 < source.length && source[pos + 1] === '*') {
      pos += 2
      col += 2
      while (
        pos + 1 < source.length &&
        !(source[pos] === '*' && source[pos + 1] === '/')
      ) {
        if (source[pos] === '\n') {
          line++
          col = 1
        } else {
          col++
        }
        pos++
      }
      pos += 2
      col += 2
      continue
    }

    // 数字
    if (/[0-9]/.test(ch)) {
      const startCol = col
      let num = ''
      let isFloat = false
      while (pos < source.length && /[0-9]/.test(source[pos])) {
        num += source[pos]
        pos++
        col++
      }
      // 浮点数
      if (pos < source.length && source[pos] === '.') {
        isFloat = true
        num += source[pos]
        pos++
        col++
        while (pos < source.length && /[0-9]/.test(source[pos])) {
          num += source[pos]
          pos++
          col++
        }
      }
      tokens.push({ type: isFloat ? 'Float' : 'Number', value: num, line, col: startCol })
      continue
    }

    // 字符
    if (ch === "'") {
      const startCol = col
      pos++
      col++
      let ch_val = ''
      if (pos < source.length && source[pos] === '\\') {
        // 转义字符
        pos++
        col++
        const escape = source[pos]
        if (escape === 'n') ch_val = '\n'
        else if (escape === 't') ch_val = '\t'
        else if (escape === '\\') ch_val = '\\'
        else if (escape === "'") ch_val = "'"
        else if (escape === '"') ch_val = '"'
        else ch_val = '\\' + escape
      } else {
        ch_val = source[pos]
      }
      pos++
      col++
      // 闭合引号
      if (pos < source.length && source[pos] === "'") {
        pos++
        col++
      }
      tokens.push({ type: 'Char', value: ch_val, line, col: startCol })
      continue
    }

    // 字符串
    if (ch === '"') {
      const startCol = col
      pos++
      col++
      let str = ''
      while (pos < source.length && source[pos] !== '"') {
        if (source[pos] === '\\') {
          pos++
          col++
          const escape = source[pos]
          if (escape === 'n') str += '\n'
          else if (escape === 't') str += '\t'
          else if (escape === '\\') str += '\\'
          else if (escape === '"') str += '"'
          else str += '\\' + escape
        } else {
          str += source[pos]
        }
        pos++
        col++
      }
      pos++ // 跳过闭合引号
      col++
      tokens.push({ type: 'String', value: str, line, col: startCol })
      continue
    }

    // 标识符/关键字
    if (/[a-zA-Z_]/.test(ch)) {
      const startCol = col
      let ident = ''
      while (pos < source.length && /[a-zA-Z0-9_]/.test(source[pos])) {
        ident += source[pos]
        pos++
        col++
      }
      if (KEYWORDS.has(ident)) {
        tokens.push({ type: 'Keyword', value: ident, line, col: startCol })
      } else {
        tokens.push({ type: 'Identifier', value: ident, line, col: startCol })
      }
      continue
    }

    // 运算符（多字符优先）
    if (OPERATORS.has(ch)) {
      // 尝试匹配双字符运算符
      const twoChar = source.substring(pos, pos + 2)
      if (OPERATORS.has(twoChar)) {
        tokens.push({ type: 'Operator', value: twoChar, line, col })
        pos += 2
        col += 2
        continue
      }
      // 三字符运算符 >>= <<=
      const threeChar = source.substring(pos, pos + 3)
      if (threeChar === '>>=' || threeChar === '<<=') {
        tokens.push({ type: 'Operator', value: threeChar, line, col })
        pos += 3
        col += 3
        continue
      }
      tokens.push({ type: 'Operator', value: ch, line, col })
      pos++
      col++
      continue
    }

    // 标点
    if (ch === '(' || ch === ')' || ch === '[' || ch === ']' || ch === '{' || ch === '}' || ch === ';' || ch === ',' || ch === '.' || ch === ':') {
      tokens.push({ type: 'Punctuation', value: ch, line, col })
      pos++
      col++
      continue
    }

    // 未知字符
    tokens.push({ type: 'Operator', value: ch, line, col })
    pos++
    col++
  }

  tokens.push({ type: 'EndOfInput', value: '', line, col })
  return tokens
}
