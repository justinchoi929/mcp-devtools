# mcp-devtools

MCP 生态的 Chrome DevTools —— 帮助 MCP Server 开发者和使用者解决 Token 膨胀、配置地狱、调试噩梦三大痛点。

## 功能

| 命令 | 解决的问题 | 说明 |
|------|-----------|------|
| `analyze` | Token 膨胀 | 分析每个工具的 Token 消耗，给出优化建议 |
| `doctor` | 配置地狱 | 一键诊断所有客户端配置，检测连通性 |
| `inspect` | 调试噩梦 | 交互式探索 MCP Server，直接调用工具 |

## 安装

```bash
npm install -g mcp-devtools
```

或在项目中使用：

```bash
npx mcp-devtools --help
```

## 使用

### `analyze` — Token 消耗分析

分析 MCP Server 的工具定义占用了多少上下文窗口。

```bash
# 分析本地 MCP Server
mcp-devtools analyze -s "node ./my-server.js"

# 输出 JSON（适合 CI/CD 集成）
mcp-devtools analyze -s "node ./my-server.js" -f json

# 输出 Markdown（适合贴到 PR 或文档）
mcp-devtools analyze -s "node ./my-server.js" -f markdown

# 指定上下文窗口大小
mcp-devtools analyze -s "node ./my-server.js" -c 128000
```

输出示例：

```
📊 MCP Token Analysis — node ./my-server.js

  Tools: 5 total
  Token Footprint: 339 tokens (0.2% of 200,000 context)

  Top consumers:
  ┌──────────────────────┬────────┬──────────────────────────────┐
  │ Tool                 │ Tokens │ Notes                        │
  ├──────────────────────┼────────┼──────────────────────────────┤
  │ search_database      │    182 │ ⚠ Description too long       │
  │ create_document      │     69 │                              │
  │ set_config           │     34 │ Missing param desc: key, val │
  │ list_users           │     29 │                              │
  │ get_config           │     25 │ Missing param desc: key      │
  └──────────────────────┴────────┴──────────────────────────────┘

  💡 Optimization suggestions:
     • 2 tool(s) have parameters without descriptions — add them for better LLM understanding

  ℹ Token counts estimated via tiktoken (cl100k_base)
```

自动检测的问题类型：

- **Description 过长**（>200 tokens）—— 浪费上下文
- **参数缺少 description** —— 影响 LLM 理解准确度
- **Schema 重复** —— 建议用 `$ref` 去重，并估算可节省的 token 数

### `doctor` — 配置诊断

一键扫描所有 MCP 客户端配置，检查格式和连通性。

```bash
# 扫描所有客户端
mcp-devtools doctor

# 只检查特定客户端
mcp-devtools doctor --client claude-code

# 跳过连通性测试（只检查配置文件）
mcp-devtools doctor --skip-connect

# 输出 JSON
mcp-devtools doctor -f json
```

输出示例：

```
🏥 MCP Health Check

  Claude Desktop:
    ❌ Config NOT FOUND at C:\Users\X\AppData\Roaming\Claude\claude_desktop_config.json
       💡 Claude Desktop config is at %APPDATA%\Claude\claude_desktop_config.json (Win)

  Claude Code:
    ✅ Config found: C:\Users\X\.claude.json
    ✅ 5 server(s) configured
    ✅ Playwright — connectable
    ✅ context7 — connectable
    ✅ mcp-deepwiki — connectable

  VS Code:
    ❌ Config NOT FOUND at .vscode/mcp.json
       💡 VS Code MCP config goes in .vscode/mcp.json — note: key is "servers" not "mcpServers"

  Cursor:
    ❌ Config NOT FOUND at .cursor/mcp.json
```

支持的客户端：

| 客户端 | 配置路径 | Key |
|--------|---------|-----|
| Claude Desktop | `%APPDATA%\Claude\claude_desktop_config.json` (Win) / `~/Library/Application Support/Claude/` (Mac) | `mcpServers` |
| Claude Code | `.mcp.json` (项目级) / `~/.claude.json` (用户级) | `mcpServers` |
| VS Code | `.vscode/mcp.json` | `servers` |
| Cursor | `.cursor/mcp.json` | `mcpServers` |

### `inspect` — 交互式探索

连接 MCP Server，浏览工具/资源/提示词，直接调用工具查看结果。

```bash
# 交互式模式（菜单驱动）
mcp-devtools inspect -s "node ./my-server.js"

# 列出所有工具（非交互式）
mcp-devtools inspect -s "node ./my-server.js" --list-tools

# 列出资源
mcp-devtools inspect -s "node ./my-server.js" --list-resources

# 调用指定工具
mcp-devtools inspect -s "node ./my-server.js" --call search_database --params '{"query":"test"}'
```

输出示例（`--list-tools`）：

```
Found 5 tools:

  search_database (182 tokens)
    Search the database for records matching the given query...
    Params: query, limit, offset

  create_document (69 tokens)
    Create a new document in the store
    Params: title, content, tags
```

输出示例（`--call`）：

```
Calling search_database with {"query":"test"}...

Result:
{
  "content": [
    {
      "type": "text",
      "text": "{\"results\":[],\"total\":0,\"query\":\"test\"}"
    }
  ]
}

⏱ 2ms
```

## 全局选项

```bash
--verbose    # 启用调试日志
--version    # 显示版本号
--help       # 显示帮助
```

## 编程接口

mcp-devtools 也导出公共 API，可在代码中直接使用：

```typescript
import { runAnalyze, runDoctor, withConnection, listTools } from 'mcp-devtools';

// Token 分析
const result = await runAnalyze({
  serverCommand: 'node ./my-server.js',
  contextWindowSize: 200_000,
});
console.log(`Total tokens: ${result.totalTokens}`);

// 配置诊断
const reports = await runDoctor({ client: 'claude-code' });

// 直接连接 MCP Server
const tools = await withConnection(
  { serverCommand: 'node ./my-server.js' },
  (conn) => listTools(conn),
);
```

## 开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行测试
npm test

# 类型检查
npx tsc --noEmit

# 开发模式（监听文件变化）
npm run dev
```

## 技术栈

| 组件 | 选型 |
|------|------|
| 语言 | TypeScript (Node.js ≥ 18) |
| CLI 框架 | Commander.js |
| 交互式提示 | @clack/prompts |
| 终端颜色 | picocolors |
| MCP 客户端 | @modelcontextprotocol/sdk |
| Token 估算 | js-tiktoken (cl100k_base) |
| 构建 | tsup |
| 测试 | vitest |

## License

MIT
