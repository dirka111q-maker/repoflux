import * as readline from 'node:readline';
import { packRepository } from '../core/packer.js';
import { sanitizeSecrets } from '../core/secrets.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Standard JSON-RPC 2.0 MCP (Model Context Protocol) Server implementation
 * over stdio.
 */

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: any;
}

export function startMcpServer(targetDir: string = process.cwd()) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  function send(response: any) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }

  function sendResult(id: any, result: any) {
    send({ jsonrpc: '2.0', id, result });
  }

  function sendError(id: any, code: number, message: string) {
    send({ jsonrpc: '2.0', id, error: { code, message } });
  }

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let req: JsonRpcRequest;
    try {
      req = JSON.parse(trimmed);
    } catch {
      sendError(null, -32700, 'Parse error: invalid JSON');
      return;
    }

    const { id, method, params } = req;

    try {
      switch (method) {
        case 'initialize': {
          sendResult(id, {
            protocolVersion: '2024-11-05',
            serverInfo: {
              name: 'repoflux-mcp',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
            },
          });
          break;
        }

        case 'notifications/initialized': {
          // Notification, no response required
          break;
        }

        case 'tools/list': {
          sendResult(id, {
            tools: [
              {
                name: 'get_repo_map',
                description: 'Get an ASCII tree map of the repository with token counts per file',
                inputSchema: {
                  type: 'object',
                  properties: {
                    dir: { type: 'string', description: 'Directory path (defaults to root)' },
                  },
                },
              },
              {
                name: 'pack_codebase',
                description: 'Bundle repository files into sanitized XML/Markdown context with token budget',
                inputSchema: {
                  type: 'object',
                  properties: {
                    dir: { type: 'string', description: 'Directory path' },
                    format: { type: 'string', enum: ['xml', 'markdown', 'json'] },
                    maxTokens: { type: 'number', description: 'Maximum token budget' },
                  },
                },
              },
              {
                name: 'audit_secrets',
                description: 'Scan the codebase for accidentally committed API keys, tokens, or credentials',
                inputSchema: {
                  type: 'object',
                  properties: {
                    dir: { type: 'string', description: 'Directory to audit' },
                  },
                },
              },
            ],
          });
          break;
        }

        case 'tools/call': {
          const toolName = params?.name;
          const args = params?.arguments || {};
          const workDir = args.dir ? path.resolve(args.dir) : targetDir;

          if (toolName === 'get_repo_map') {
            const packed = await packRepository({ rootDir: workDir, maxTokens: 1 });
            sendResult(id, {
              content: [
                {
                  type: 'text',
                  text: packed.tree,
                },
              ],
            });
          } else if (toolName === 'pack_codebase') {
            const packed = await packRepository({
              rootDir: workDir,
              format: args.format || 'xml',
              maxTokens: args.maxTokens,
            });
            sendResult(id, {
              content: [
                {
                  type: 'text',
                  text: packed.output,
                },
              ],
            });
          } else if (toolName === 'audit_secrets') {
            const packed = await packRepository({ rootDir: workDir, redactSecrets: true });
            const detections = packed.secretDetections;
            const report = detections.length === 0
              ? '✅ No secrets or leaked credentials detected in repository.'
              : `⚠️ Found secrets in ${detections.length} files:\n` +
                detections.map((d) => `- ${d.file}: ${d.matches.map((m) => `${m.type} (line ${m.line})`).join(', ')}`).join('\n');

            sendResult(id, {
              content: [
                {
                  type: 'text',
                  text: report,
                },
              ],
            });
          } else {
            sendError(id, -32601, `Unknown tool: ${toolName}`);
          }
          break;
        }

        default: {
          sendError(id, -32601, `Method not found: ${method}`);
        }
      }
    } catch (err: any) {
      sendError(id, -32603, `Internal error: ${err?.message || err}`);
    }
  });
}
