#!/usr/bin/env node

/**
 * A minimal MCP server for testing purposes.
 * Exposes a few tools with varying schema complexity.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'sample-server', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'search_database',
      description: 'Search the database for records matching the given query. This tool performs a full-text search across all indexed fields in the database, supporting complex boolean expressions, wildcard matching, and fuzzy search. Results are returned in relevance order with pagination support. The search engine supports multiple languages and performs automatic stemming and tokenization. You can also specify field-specific queries using the field:value syntax. Advanced features include proximity search, boosting, and filtering by date ranges. This is a very long description that should trigger the description-too-long warning in our analyzer because it exceeds the 200 token threshold we have set for optimal context usage.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          query: { type: 'string', description: 'The search query string' },
          limit: { type: 'number', description: 'Maximum number of results to return' },
          offset: { type: 'number', description: 'Number of results to skip for pagination' },
        },
        required: ['query'],
      },
    },
    {
      name: 'create_document',
      description: 'Create a new document in the store',
      inputSchema: {
        type: 'object' as const,
        properties: {
          title: { type: 'string', description: 'Document title' },
          content: { type: 'string', description: 'Document body content' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Tags for categorization' },
        },
        required: ['title', 'content'],
      },
    },
    {
      name: 'list_users',
      description: 'List all users in the system',
      inputSchema: {
        type: 'object' as const,
        properties: {
          role: { type: 'string', description: 'Filter by user role' },
        },
      },
    },
    {
      name: 'get_config',
      description: 'Get a configuration value',
      inputSchema: {
        type: 'object' as const,
        properties: {
          key: { type: 'string' }, // intentionally missing description
        },
        required: ['key'],
      },
    },
    {
      name: 'set_config',
      description: 'Set a configuration value',
      inputSchema: {
        type: 'object' as const,
        properties: {
          key: { type: 'string' },   // intentionally missing description
          value: { type: 'string' }, // intentionally missing description
        },
        required: ['key', 'value'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  switch (name) {
    case 'search_database':
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ results: [], total: 0, query: args?.query }) }],
      };
    case 'create_document':
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ id: 'doc-123', created: true }) }],
      };
    case 'list_users':
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ users: [{ name: 'Alice' }, { name: 'Bob' }] }) }],
      };
    case 'get_config':
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ key: args?.key, value: 'test-value' }) }],
      };
    case 'set_config':
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true }) }],
      };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
