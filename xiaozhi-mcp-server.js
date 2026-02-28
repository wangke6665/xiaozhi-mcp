#!/usr/bin/env node
/**
 * OpenClaw MCP Server for 小智 AI
 * 让小智 AI 可以通过 MCP 协议调用 OpenClaw 的功能
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'openclaw-xiaozhi-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 定义可用工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_command',
        description: '执行系统命令',
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: '要执行的命令',
            },
          },
          required: ['command'],
        },
      },
      {
        name: 'read_file',
        description: '读取文件内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: '文件路径',
            },
          },
          required: ['path'],
        },
      },
      {
        name: 'web_search',
        description: '搜索网络信息',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'send_message',
        description: '发送消息到指定渠道',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: '渠道 (telegram/whatsapp/etc)',
            },
            message: {
              type: 'string',
              description: '消息内容',
            },
          },
          required: ['channel', 'message'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'execute_command':
        // 注意：实际实现需要安全检查
        return {
          content: [
            {
              type: 'text',
              text: `命令 "${args.command}" 已接收。出于安全考虑，请通过 OpenClaw 直接执行。`,
            },
          ],
        };

      case 'read_file':
        return {
          content: [
            {
              type: 'text',
              text: `文件读取功能已就绪。路径: ${args.path}`,
            },
          ],
        };

      case 'web_search':
        return {
          content: [
            {
              type: 'text',
              text: `搜索 "${args.query}" 的结果将在这里显示。`,
            },
          ],
        };

      case 'send_message':
        return {
          content: [
            {
              type: 'text',
              text: `消息已准备发送到 ${args.channel}: "${args.message}"`,
            },
          ],
        };

      default:
        throw new Error(`未知工具: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `错误: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('OpenClaw MCP Server for 小智 AI 已启动');
}

main().catch(console.error);
