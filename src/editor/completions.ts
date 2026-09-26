import * as monaco from 'monaco-editor'

/**
 * C++ 代码补全注册
 * 
 * 注册 Monaco 补全提供者，支持：
 * - 关键字
 * - 数据类型
 * - 内置函数
 * - 常用宏/常量
 * - 常用代码片段 (snippets)
 */

// ─── 关键字 ─────────────────────────────────────────────────────────

const KEYWORDS = [
  'int', 'float', 'double', 'char', 'bool', 'void', 'auto',
  'const', 'static', 'long', 'short', 'unsigned', 'signed',
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
  'break', 'continue', 'return',
  'true', 'false', 'nullptr', 'NULL',
  'struct', 'class', 'enum', 'union', 'namespace', 'using',
  'template', 'typename', 'public', 'private', 'protected',
  'virtual', 'override', 'inline', 'extern', 'volatile',
  'sizeof', 'new', 'delete', 'this',
  'throw', 'try', 'catch', 'finally',
  'friend', 'operator', 'typedef', 'typedef',
  'co_await', 'co_yield', 'co_return',
]

// ─── 数据类型 ────────────────────────────────────────────────────────

const TYPES = [
  'string', 'vector', 'map', 'set', 'array', 'pair', 'tuple',
  'stack', 'queue', 'priority_queue', 'deque', 'list',
  'size_t', 'int8_t', 'int16_t', 'int32_t', 'int64_t',
  'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t',
]

// ─── 内置函数 ────────────────────────────────────────────────────────

const FUNCTIONS = [
  'cin', 'cout', 'cerr', 'endl',
  'abs', 'sqrt', 'pow', 'ceil', 'floor', 'round',
  'max', 'min', 'swap', 'sort', 'reverse',
  'find', 'count', 'accumulate',
  'strlen', 'strcpy', 'strcmp', 'strcat',
  'print',
]

// ─── 常用片段 (Snippets) ────────────────────────────────────────────

interface Snippet {
  label: string
  insertText: string
  detail: string
  documentation?: string
  kind: monaco.languages.CompletionItemKind
}

const SNIPPETS: Snippet[] = [
  {
    label: 'main',
    insertText: 'int main() {\n    $0\n    return 0;\n}',
    detail: 'int main() { ... }',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'if',
    insertText: 'if ($1) {\n    $0\n}',
    detail: 'if (condition) { ... }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'if-else',
    insertText: 'if ($1) {\n    $2\n} else {\n    $0\n}',
    detail: 'if (condition) { ... } else { ... }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'for',
    insertText: 'for (int $1 = 0; $1 < $2; $1++) {\n    $0\n}',
    detail: 'for (int i = 0; i < n; i++) { ... }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'for-arr',
    insertText: 'for (int $1 = 0; $1 < sizeof($2) / sizeof($2[0]); $1++) {\n    $0\n}',
    detail: 'for (int i = 0; i < arr_len; i++) { ... }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'while',
    insertText: 'while ($1) {\n    $0\n}',
    detail: 'while (condition) { ... }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'do-while',
    insertText: 'do {\n    $0\n} while ($1);',
    detail: 'do { ... } while (condition);',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'switch',
    insertText: 'switch ($1) {\n    case $2: $3 break;\n    default:\n        $0\n}',
    detail: 'switch (var) { case: ... break; }',
    kind: monaco.languages.CompletionItemKind.Keyword,
  },
  {
    label: 'fun',
    insertText: '$1 $2($3) {\n    $0\n}',
    detail: 'function returnType name(params) { ... }',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'fun-int',
    insertText: 'int $1($2) {\n    $0\n}',
    detail: 'int funcName(params) { ... }',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'fun-void',
    insertText: 'void $1($2) {\n    $0\n}',
    detail: 'void funcName(params) { ... }',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'cout',
    insertText: 'cout << $1 << endl;',
    detail: 'cout << value << endl;',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'cin',
    insertText: 'cin >> $1;',
    detail: 'cin >> variable;',
    kind: monaco.languages.CompletionItemKind.Function,
  },
  {
    label: 'cpp',
    insertText: '#include <iostream>\nusing namespace std;\n\nint main() {\n    $0\n    return 0;\n}',
    detail: '完整 C++ 模板',
    kind: monaco.languages.CompletionItemKind.Snippet,
  },
  {
    label: 'int-var',
    insertText: 'int $1 = $2;',
    detail: 'int var = value;',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'double-var',
    insertText: 'double $1 = $2;',
    detail: 'double var = value;',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'string-var',
    insertText: 'string $1 = "$2";',
    detail: 'string var = "value";',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'arr',
    insertText: '$1 $2[$3];',
    detail: 'type arr[size];',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'vec',
    insertText: 'vector<$1> $2;',
    detail: 'vector<Type> vec;',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'map',
    insertText: 'map<$1, $2> $3;',
    detail: 'map<Key, Value> map;',
    kind: monaco.languages.CompletionItemKind.Field,
  },
  {
    label: 'struct',
    insertText: 'struct $1 {\n    $0\n};',
    detail: 'struct Name { ... };',
    kind: monaco.languages.CompletionItemKind.Struct,
  },
]

/**
 * 注册 C++ 补全提供者
 */
export function registerCppCompletions(): void {
  monaco.languages.registerCompletionItemProvider('cpp', {
    triggerCharacters: ['.', '(', ':', '<'],

    provideCompletionItems(model, position) {
      const lineContent = model.getLineContent(position.lineNumber)
      const wordBefore = model.getWordUntilPosition(position)
      const range = new monaco.Range(
        position.lineNumber, wordBefore.startColumn,
        position.lineNumber, wordBefore.endColumn,
      )

      const suggestions: monaco.languages.CompletionItem[] = []

      // 代码片段
      for (const s of SNIPPETS) {
        suggestions.push({
          label: s.label,
          kind: s.kind,
          insertText: s.insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail: s.detail,
          documentation: s.documentation || s.detail,
          range,
          sortText: '00' + s.label,
        })
      }

      // 关键字
      for (const kw of KEYWORDS) {
        suggestions.push({
          label: kw,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: kw,
          detail: '关键字',
          range,
          sortText: '10' + kw,
        })
      }

      // 数据类型
      for (const t of TYPES) {
        suggestions.push({
          label: t,
          kind: monaco.languages.CompletionItemKind.Interface,
          insertText: t,
          detail: '数据类型',
          range,
          sortText: '20' + t,
        })
      }

      // 内置函数
      for (const f of FUNCTIONS) {
        suggestions.push({
          label: f,
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: f,
          detail: '内置函数',
          range,
          sortText: '30' + f,
        })
      }

      // 预处理器
      suggestions.push({
        label: '#include',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: '#include <$0>',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: '#include <header>',
        range,
        sortText: '00#include',
      })
      suggestions.push({
        label: '#include',
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: '#include <$1>\nusing namespace std;',
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        detail: '#include + using namespace',
        range,
        sortText: '00#include2',
      })

      // 头文件常用
      for (const header of ['iostream', 'string', 'vector', 'map', 'set', 'algorithm', 'cmath', 'cstring', 'cstdio']) {
        suggestions.push({
          label: header,
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: header,
          detail: `#include <${header}>`,
          range,
          sortText: '40' + header,
        })
      }

      return { suggestions }
    },
  })
}
