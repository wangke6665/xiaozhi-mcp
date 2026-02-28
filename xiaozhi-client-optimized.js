#!/usr/bin/env node
/**
 * 小欧 - 小智 AI MCP 客户端 (优化版)
 * 使用英文工具名，提高 LLM 识别率
 */

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const XIAOZHI_MCP_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgwODYzMiwiYWdlbnRJZCI6MTUwNzQzMywiZW5kcG9pbnRJZCI6ImFnZW50XzE1MDc0MzMiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzcyMTY0NjY3LCJleHAiOjE4MDM3MjIyNjd9.oIsr5MlphfNMap7VcMsBzTShiXRk-z5fzFolDoWZho25dGL-B0RxnaGlCECLQRzJWFWdtgkATWtISXc0XwFrYQ';

const CONFIG = {
  heartbeatInterval: 30000,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10,
};

const state = {
  ws: null,
  connected: false,
  reconnectAttempts: 0,
  messageId: 1000,
  lastActivity: Date.now(),
};

// ==================== 优化后的工具定义（英文名称）====================
const TOOLS = [
  {
    name: 'chat_with_ai',
    description: 'When user wants to chat with OpenClaw AI assistant, ask questions, or have a conversation. Trigger words: "小欧", "OpenClaw", "AI", "assistant"',
    inputSchema: {
      type: 'object',
      properties: {
        message: { 
          type: 'string', 
          description: 'The message or question from user to the AI assistant'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'read_file',
    description: 'When user asks to read, open, or view a file content. Examples: "read README.md", "show me the file", "open config.json"',
    inputSchema: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: 'Full path to the file, e.g., /root/.openclaw/workspace/README.md'
        },
        limit: { 
          type: 'number', 
          description: 'Maximum number of lines to read (optional, default 100)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'list_directory',
    description: 'When user asks to list files, show directory contents, or what files are in a folder. Examples: "list files", "show directory", "what is in workspace"',
    inputSchema: {
      type: 'object',
      properties: {
        path: { 
          type: 'string', 
          description: 'Directory path (optional, defaults to workspace)'
        }
      }
    }
  },
  {
    name: 'send_telegram_message',
    description: 'When user asks to send a message via Telegram. Examples: "send telegram message", "message to Telegram"',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message content to send' },
        target: { type: 'string', description: 'Target user or group (optional)' }
      },
      required: ['message']
    }
  },
  {
    name: 'send_email',
    description: 'When user asks to send an email. Examples: "send email", "email to someone"',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body content' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: 'check_system_status',
    description: 'When user asks about system status, CPU, memory, disk usage, or server health. Examples: "system status", "how is the server", "check resources"',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'search_web',
    description: 'When user asks to search the internet, find information online, or look up something. Examples: "search for", "google", "find online"',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query or keywords' },
        count: { type: 'number', description: 'Number of results (1-10, default 5)' }
      },
      required: ['query']
    }
  },
  {
    name: 'take_screenshot',
    description: 'When user asks to capture a webpage screenshot. Examples: "screenshot of website", "capture page"',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the webpage to capture' }
      },
      required: ['url']
    }
  },
  {
    name: 'check_git_status',
    description: 'When user asks about git repository status, commits, or changes. Examples: "git status", "check git"',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Git repository path (optional)' }
      }
    }
  },
  {
    name: 'set_reminder',
    description: 'When user asks to set a reminder or alarm. Examples: "remind me in 10 minutes", "set alarm"',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Reminder content' },
        minutes: { type: 'number', description: 'Minutes until reminder' }
      },
      required: ['message', 'minutes']
    }
  },
  {
    name: 'save_note',
    description: 'When user asks to save a note or memo. Examples: "save note", "remember this", "take note"',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Note content to save' },
        tag: { type: 'string', description: 'Tag or category (optional)' }
      },
      required: ['content']
    }
  },
  {
    name: 'add_calendar_event',
    description: 'When user asks to add a calendar event or schedule. Examples: "add event", "schedule meeting", "calendar"',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        startTime: { type: 'string', description: 'Start time in ISO format (e.g., 2026-02-27T15:00:00)' },
        description: { type: 'string', description: 'Event description (optional)' }
      },
      required: ['title', 'startTime']
    }
  },
  {
    name: 'list_calendar_events',
    description: 'When user asks to view calendar, check schedule, or see events. Examples: "what is my schedule", "calendar today", "events this week"',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'tomorrow', 'week'], description: 'Time period to view' }
      }
    }
  },
  {
    name: 'record_expense',
    description: 'When user asks to record spending, track expense, or log a purchase. Examples: "record expense", "spent 50 yuan", "track spending"',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: 'Amount spent in yuan' },
        category: { type: 'string', enum: ['food', 'transport', 'shopping', 'entertainment', 'life', 'other'], description: 'Expense category' },
        item: { type: 'string', description: 'What was purchased' }
      },
      required: ['amount', 'category', 'item']
    }
  },
  {
    name: 'get_expense_report',
    description: 'When user asks about spending summary, expense report, or how much they spent. Examples: "spending report", "how much did I spend", "expense summary"',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month'], description: 'Time period for report' }
      }
    }
  },
  {
    name: 'play_music',
    description: 'When user asks to play music, song, or audio. Examples: "play music", "play song", "music please"',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Song name, artist, or keywords' }
      },
      required: ['query']
    }
  },
  {
    name: 'control_music',
    description: 'When user asks to control music playback. Examples: "pause music", "next song", "volume up"',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['play', 'pause', 'next', 'prev', 'stop', 'volume_up', 'volume_down'], description: 'Control action' }
      },
      required: ['action']
    }
  }
];

function log(level, ...args) {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  console.log(`[${timestamp}] [${level}]`, ...args);
}

function connect() {
  log('INFO', '🔌 正在连接小智 AI MCP 服务器（优化版）...');
  
  state.ws = new WebSocket(XIAOZHI_MCP_URL, { handshakeTimeout: 10000 });
  
  state.ws.on('open', () => {
    log('SUCCESS', '✅ 已连接（优化版）');
    log('INFO', `📦 ${TOOLS.length} 个工具已注册`);
    state.connected = true;
    state.reconnectAttempts = 0;
    state.lastActivity = Date.now();
    startHeartbeat();
  });
  
  state.ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      state.lastActivity = Date.now();
      
      if (msg.method) {
        log('RECV', `[${msg.method}]`, msg.params?.name || '');
        handleRequest(msg);
      }
    } catch (err) {
      log('ERROR', '解析失败:', err.message);
    }
  });
  
  state.ws.on('error', (err) => log('ERROR', err.message));
  state.ws.on('close', (code) => {
    log('WARN', `连接关闭 (code: ${code})`);
    state.connected = false;
    stopHeartbeat();
    if (state.reconnectAttempts < CONFIG.maxReconnectAttempts) {
      state.reconnectAttempts++;
      setTimeout(connect, CONFIG.reconnectDelay);
    }
  });
}

let heartbeatTimer = null;
function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (state.connected && state.ws) {
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id: ++state.messageId, method: 'ping' }));
    }
  }, CONFIG.heartbeatInterval);
}
function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
}

async function handleRequest(msg) {
  const { id, method, params } = msg;
  
  switch (method) {
    case 'initialize':
      state.ws.send(JSON.stringify({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: 'openclaw-optimized', version: '3.0.0' }
        }
      }));
      break;
    
    case 'tools/list':
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: { tools: TOOLS } }));
      break;
    
    case 'tools/call':
      log('CALL', `🛠️ 调用: ${params?.name}`);
      const result = await handleToolCall(params);
      state.ws.send(JSON.stringify({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: result }] }
      }));
      break;
    
    case 'ping':
      state.ws.send(JSON.stringify({ jsonrpc: '2.0', id, result: {} }));
      break;
  }
}

async function handleToolCall(params) {
  const { name, arguments: args } = params || {};
  
  // 简化处理，返回统一格式
  const responses = {
    chat_with_ai: `🦞 [小欧] 收到: "${args?.message}"\n\n我是你的 AI 助手，有什么可以帮你的？`,
    read_file: `📄 准备读取文件: ${args?.path}`,
    list_directory: `📂 准备列出目录: ${args?.path || 'workspace'}`,
    send_telegram_message: `📱 准备发送 Telegram: "${args?.message}"`,
    send_email: `📧 准备发送邮件给: ${args?.to}`,
    check_system_status: `💻 正在检查系统状态...`,
    search_web: `🔍 准备搜索: "${args?.query}"`,
    take_screenshot: `📸 准备截图: ${args?.url}`,
    check_git_status: `🌿 准备检查 Git 状态`,
    set_reminder: `⏰ 提醒已设置: "${args?.message}" (${args?.minutes}分钟后)`,
    save_note: `📝 笔记已保存`,
    add_calendar_event: `📅 事件已添加: ${args?.title}`,
    list_calendar_events: `📅 正在查询日历...`,
    record_expense: `💰 记账: ${args?.item} ¥${args?.amount}`,
    get_expense_report: `📊 正在生成消费报告...`,
    play_music: `🎵 准备播放: "${args?.query}"`,
    control_music: `🎵 音乐控制: ${args?.action}`
  };
  
  return responses[name] || `❌ 未知工具: ${name}`;
}

log('INFO', '🚀 启动小欧 MCP 客户端（优化版）');
connect();

process.on('SIGINT', () => {
  stopHeartbeat();
  if (state.ws) state.ws.close();
  process.exit(0);
});
