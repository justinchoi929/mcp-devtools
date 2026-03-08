import { encodingForModel } from 'js-tiktoken';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { ToolTokenInfo, TokenWarning, OptimizationSuggestion } from '../types/index.js';

const DESCRIPTION_TOKEN_THRESHOLD = 200;

let encoder: ReturnType<typeof encodingForModel> | null = null;

function getEncoder() {
  if (!encoder) {
    encoder = encodingForModel('gpt-4o');
  }
  return encoder;
}

/**
 * Count tokens in a string using tiktoken (cl100k_base).
 */
export function countTokens(text: string): number {
  return getEncoder().encode(text).length;
}

/**
 * Serialize a tool definition the same way LLM providers do:
 * name + description + JSON-serialized inputSchema.
 */
function serializeTool(tool: Tool): string {
  const parts: string[] = [tool.name];
  if (tool.description) {
    parts.push(tool.description);
  }
  if (tool.inputSchema) {
    parts.push(JSON.stringify(tool.inputSchema));
  }
  return parts.join('\n');
}

/**
 * Analyze token consumption for a single tool.
 */
export function analyzeToolTokens(tool: Tool): ToolTokenInfo {
  const nameTokens = countTokens(tool.name);
  const descTokens = tool.description ? countTokens(tool.description) : 0;
  const schemaTokens = tool.inputSchema ? countTokens(JSON.stringify(tool.inputSchema)) : 0;
  const totalTokens = nameTokens + descTokens + schemaTokens;

  const warnings: TokenWarning[] = [];

  // Check description length
  if (descTokens > DESCRIPTION_TOKEN_THRESHOLD) {
    warnings.push({
      type: 'description_too_long',
      tokens: descTokens,
      threshold: DESCRIPTION_TOKEN_THRESHOLD,
    });
  }

  // Check for missing param descriptions
  const missingDescParams = findMissingParamDescriptions(tool);
  if (missingDescParams.length > 0) {
    warnings.push({
      type: 'missing_param_description',
      params: missingDescParams,
    });
  }

  return {
    name: tool.name,
    description: tool.description ?? '',
    tokens: totalTokens,
    breakdown: {
      name: nameTokens,
      description: descTokens,
      schema: schemaTokens,
    },
    warnings,
  };
}

/**
 * Find parameters that lack a "description" field in the schema.
 */
function findMissingParamDescriptions(tool: Tool): string[] {
  const missing: string[] = [];
  const props = (tool.inputSchema as Record<string, unknown>)?.properties;
  if (props && typeof props === 'object') {
    for (const [key, value] of Object.entries(props as Record<string, Record<string, unknown>>)) {
      if (!value.description) {
        missing.push(key);
      }
    }
  }
  return missing;
}

/**
 * Detect duplicate schemas across tools.
 */
function findDuplicateSchemas(tools: Tool[]): Map<string, string[]> {
  const schemaMap = new Map<string, string[]>();
  for (const tool of tools) {
    const schemaStr = tool.inputSchema ? JSON.stringify(tool.inputSchema) : '';
    if (!schemaStr) continue;
    const existing = schemaMap.get(schemaStr);
    if (existing) {
      existing.push(tool.name);
    } else {
      schemaMap.set(schemaStr, [tool.name]);
    }
  }
  // Only return entries with duplicates
  const duplicates = new Map<string, string[]>();
  for (const [schema, names] of schemaMap) {
    if (names.length > 1) {
      duplicates.set(schema, names);
    }
  }
  return duplicates;
}

/**
 * Analyze all tools and generate optimization suggestions.
 */
export function analyzeAllTools(tools: Tool[], contextWindowSize = 200_000): {
  toolInfos: ToolTokenInfo[];
  suggestions: OptimizationSuggestion[];
  totalTokens: number;
} {
  const toolInfos = tools.map(analyzeToolTokens);
  const totalTokens = toolInfos.reduce((sum, t) => sum + t.tokens, 0);
  const suggestions: OptimizationSuggestion[] = [];

  // Suggestion: trim long descriptions
  const longDescTools = toolInfos.filter(t =>
    t.warnings.some(w => w.type === 'description_too_long'),
  );
  if (longDescTools.length > 0) {
    const savings = longDescTools.reduce((sum, t) => {
      const descWarning = t.warnings.find(w => w.type === 'description_too_long');
      if (descWarning && descWarning.type === 'description_too_long') {
        return sum + (descWarning.tokens - 100); // target ~100 tokens
      }
      return sum;
    }, 0);

    suggestions.push({
      type: 'trim_description',
      message: `${longDescTools.length} tool(s) have descriptions over ${DESCRIPTION_TOKEN_THRESHOLD} tokens — trim to <100`,
      estimatedSavings: savings,
      affectedTools: longDescTools.map(t => t.name),
    });
  }

  // Suggestion: deduplicate schemas
  const duplicates = findDuplicateSchemas(tools);
  if (duplicates.size > 0) {
    let dupSavings = 0;
    const affectedTools: string[] = [];
    for (const [schema, names] of duplicates) {
      const schemaTokens = countTokens(schema);
      dupSavings += schemaTokens * (names.length - 1);
      affectedTools.push(...names);
    }

    suggestions.push({
      type: 'deduplicate_schema',
      message: `${duplicates.size} group(s) of tools share identical schemas — use $ref (save ~${dupSavings.toLocaleString()} tokens)`,
      estimatedSavings: dupSavings,
      affectedTools: [...new Set(affectedTools)],
    });
  }

  // Suggestion: add param descriptions
  const missingDescTools = toolInfos.filter(t =>
    t.warnings.some(w => w.type === 'missing_param_description'),
  );
  if (missingDescTools.length > 0) {
    suggestions.push({
      type: 'add_param_description',
      message: `${missingDescTools.length} tool(s) have parameters without descriptions — add them for better LLM understanding`,
      estimatedSavings: 0,
      affectedTools: missingDescTools.map(t => t.name),
    });
  }

  // Sort tools by token count descending
  toolInfos.sort((a, b) => b.tokens - a.tokens);

  return { toolInfos, suggestions, totalTokens };
}
