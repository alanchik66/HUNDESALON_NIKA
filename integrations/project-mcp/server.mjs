import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createProjectReader } from './policy.mjs';

const pathSchema = { type: 'string', minLength: 1, maxLength: 4096, description: 'Project-relative path using forward slashes; no links or secret paths.' };
const annotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const tools = [
  { name: 'project_info', description: 'Describe this project-scoped read-only MCP and its limits.', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations },
  { name: 'list_files', description: 'List up to 200 permitted source entries in one project directory.', inputSchema: { type: 'object', properties: { path: pathSchema }, additionalProperties: false }, annotations },
  { name: 'read_text', description: 'Read one UTF-8 source file up to 256 KiB within the project. Secret, generated, link and binary paths are denied.', inputSchema: { type: 'object', properties: { path: pathSchema }, required: ['path'], additionalProperties: false }, annotations },
];

try {
  if (process.argv.length !== 4 || process.argv[2] !== '--root') throw new Error('Explicit --root is required');
  const reader = await createProjectReader(process.argv[3]);
  const server = new Server({ name: 'hundesalon-nika-project-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async request => {
    try {
      const { name, arguments: args = {} } = request.params;
      if (!tools.some(tool => tool.name === name) || args === null || Array.isArray(args) || typeof args !== 'object' ||
        Object.keys(args).some(key => key !== 'path' || name === 'project_info')) throw new Error('Invalid arguments');
      let result;
      if (name === 'project_info') result = { project: 'HUNDESALON_NIKA', readOnly: true, maxFileBytes: 262144, maxEntries: 200, shell: false, network: false };
      else if (name === 'list_files') result = await reader.list(args.path ?? '.');
      else if (typeof args.path === 'string') result = await reader.read(args.path);
      else throw new Error('Path is required');
      return { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] };
    } catch {
      return { isError: true, content: [{ type: 'text', text: 'Access denied or source unavailable. Only permitted project-relative source paths can be read.' }] };
    }
  });
  await server.connect(new StdioServerTransport());
} catch {
  console.error('Project MCP startup failed: supply an existing --root directory.');
  process.exitCode = 1;
}
