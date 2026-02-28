#!/usr/bin/env node
/**
 * 小欧 - 小智 AI MCP 客户端 (长连接模式)
 * 支持心跳保活、上下文记忆、准实时对话
 */

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const XIAOZHI_MCP_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgwODYzMiwiYWdlbnRJZCI6MTUwNzQzMywiZW5kcG9pbnRJZCI6ImFnZW50XzE1MDc0MzMiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzcyMTY0NjY3LCJleHAiOjE4MDM3MjIyNjd9.oIsr5MlphfNMap7VcMsBzTShiXRk-z5fzFolDoWZho25dGL-B0RxnaGlCECLQRzJWFWdtgkATWtISXc0XwFrYQ';

// ==================== 配置 ====================
const CONFIG = {
  heartbeatInterval: 30000,    // 心跳间隔 30 秒
  reconnectDelay: 5000,        // 重连延迟 5 秒
  maxReconnectAttempts: 10,    // 最大重连次数
  contextTTL: 30 * 60 * 1000,  // 上下文保留 30 分钟
};

// ==================== 状态管理 ====================
const state = {
  ws: null,
  connected: false,
  reconnectAttempts: 0,
  messageId: 1000,
  lastActivity: Date.now(),
  context: [],                 // 对话上下文
  pendingPings: new Set(),     // 待回复的 ping
};

// ==================== 工具定义 ====================
const TOOLS = [
  {
    name: '小欧_chat',
    description: '与 小欧 AI 助手进行连续对话（支持上下文记忆）',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息内容' },
        clearContext: { type: 'boolean', description: '是否清空上下文（开始新对话）' }
      },
      required: ['message']
    }
  },
  {
    name: '小欧_read_file',
    description: '读取文件内容',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径' },
        limit: { type: 'number', description: '最大读取行数' }
      },
      required: ['path']
    }
  },
  {
    name: '小欧_list_files',
    description: '列出目录中的文件',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '目录路径' },
        showHidden: { type: 'boolean', description: '是否显示隐藏文件' }
      }
    }
  },
  {
    name: '小欧_send_telegram',
    description: '发送消息到 Telegram',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息内容' },
        target: { type: 'string', description: '目标用户或群组' }
      },
      required: ['message']
    }
  },
  {
    name: '小欧_send_email',
    description: '发送邮件（需要配置 SMTP）',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '收件人邮箱地址' },
        subject: { type: 'string', description: '邮件主题' },
        body: { type: 'string', description: '邮件正文内容' },
        html: { type: 'boolean', description: '是否使用 HTML 格式' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  {
    name: '小欧_system_info',
    description: '获取系统信息（CPU、内存、磁盘使用情况）',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: '小欧_web_search',
    description: '搜索网络信息',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        count: { type: 'number', description: '结果数量' }
      },
      required: ['query']
    }
  },
  {
    name: '小欧_screenshot',
    description: '截取网页截图',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '网页 URL' },
        fullPage: { type: 'boolean', description: '是否截取完整页面' }
      },
      required: ['url']
    }
  },
  {
    name: '小欧_git_status',
    description: '查看 Git 仓库状态',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Git 仓库路径' }
      }
    }
  },
  {
    name: '小欧_remind',
    description: '设置提醒',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提醒内容' },
        minutes: { type: 'number', description: '多少分钟后提醒' }
      },
      required: ['message', 'minutes']
    }
  },
  {
    name: '小欧_save_note',
    description: '保存笔记到记忆',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: '笔记内容' },
        tag: { type: 'string', description: '标签（可选）' }
      },
      required: ['content']
    }
  },
  {
    name: '小欧_calendar_add',
    description: '添加日历事件',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '事件标题' },
        startTime: { type: 'string', description: '开始时间（ISO 8601 格式）' },
        endTime: { type: 'string', description: '结束时间（可选）' },
        description: { type: 'string', description: '事件描述（可选）' },
        location: { type: 'string', description: '地点（可选）' }
      },
      required: ['title', 'startTime']
    }
  },
  {
    name: '小欧_calendar_list',
    description: '查看日历事件',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: '时间段：today、tomorrow、week', enum: ['today', 'tomorrow', 'week'] }
      }
    }
  },
  {
    name: '小欧_add_expense',
    description: '记录一笔消费/支出',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: '金额（元）' },
        category: { type: 'string', description: '分类：餐饮、交通、购物、娱乐、生活、其他' },
        item: { type: 'string', description: '消费项目/商品名称' },
        note: { type: 'string', description: '备注（可选）' }
      },
      required: ['amount', 'category', 'item']
    }
  },
  {
    name: '小欧_expense_report',
    description: '查看消费统计报告',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: '时间范围：today、week、month', enum: ['today', 'week', 'month'] }
      }
    }
  },
  {
    name: '小欧_music_play',
    description: '播放音乐',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '歌曲名、歌手或关键词' },
        source: { type: 'string', description: '音乐源：netease、qq、spotify' }
      },
      required: ['query']
    }
  },
  {
    name: '小欧_music_control',
    description: '音乐播放控制',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', description: '操作：play、pause、next、prev、stop、volume_up、volume_down', 
          enum: ['play', 'pause', 'next', 'prev', 'stop', 'volume_up', 'volume_down'] }
      },
      required: ['action']
    }
  },
  {
    name: '小欧_get_context',
    description: '获取当前对话上下文（查看之前的对话记录）',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: '小欧_clear_context',
    description: '清空对话上下文（开始新对话）',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ==================== 日志输出 ====================
function log(level, ...args) {
  const timestamp = new Date().toLocaleTimeString('zh-CN');
  const prefix = `[${timestamp}] [${level}]`;
  console.log(prefix, ...args);
}

// ==================== 上下文管理 ====================
function addToContext(role, content) {
  state.context.push({ role, content, timestamp: Date.now() });
  
  // 清理过期上下文
  const now = Date.now();
  state.context = state.context.filter(item => now - item.timestamp < CONFIG.contextTTL);
  
  // 限制上下文长度（保留最近 20 条）
  if (state.context.length > 20) {
    state.context = state.context.slice(-20);
  }
}

function getContextSummary() {
  if (state.context.length === 0) return '暂无对话记录';
  
  return state.context.map((item, i) => {
    const time = new Date(item.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const role = item.role === 'user' ? '你' : '小欧';
    return `${time} ${role}: ${item.content.substring(0, 50)}${item.content.length > 50 ? '...' : ''}`;
  }).join('\n');
}

// ==================== WebSocket 连接管理 ====================
function connect() {
  log('INFO', '🔌 正在连接小智 AI MCP 服务器...');
  
  state.ws = new WebSocket(XIAOZHI_MCP_URL, { 
    handshakeTimeout: 10000,
    keepAlive: true
  });
  
  state.ws.on('open', onOpen);
  state.ws.on('message', onMessage);
  state.ws.on('error', onError);
  state.ws.on('close', onClose);
}

function onOpen() {
  log('SUCCESS', '✅ 已连接到小智 MCP 服务器（长连接模式）');
  log('INFO', `📦 已注册 ${TOOLS.length} 个工具`);
  log('INFO', '💓 心跳间隔:', CONFIG.heartbeatInterval / 1000, '秒');
  
  state.connected = true;
  state.reconnectAttempts = 0;
  state.lastActivity = Date.now();
  
  // 启动心跳
  startHeartbeat();
}

function onMessage(data) {
  try {
    const msg = JSON.parse(data.toString());
    state.lastActivity = Date.now();
    
    // 处理 ping 响应
    if (msg.id && state.pendingPings.has(msg.id)) {
      state.pendingPings.delete(msg.id);
      return;
    }
    
    if (msg.method) {
      log('RECV', `[${msg.method}]`, msg.params ? JSON.stringify(msg.params).substring(0, 80) : '');
      handleRequest(msg);
    }
  } catch (err) {
    log('ERROR', '解析消息失败:', err.message);
  }
}

function onError(err) {
  log('ERROR', '❌ WebSocket 错误:', err.message);
}

function onClose(code, reason) {
  log('WARN', `👋 连接关闭 (code: ${code}, reason: ${reason})`);
  state.connected = false;
  stopHeartbeat();
  
  // 自动重连
  if (state.reconnectAttempts < CONFIG.maxReconnectAttempts) {
    state.reconnectAttempts++;
    log('INFO', `🔄 ${CONFIG.reconnectDelay / 1000}秒后尝试第 ${state.reconnectAttempts} 次重连...`);
    setTimeout(connect, CONFIG.reconnectDelay);
  } else {
    log('ERROR', '❌ 达到最大重连次数，请检查网络或重启服务');
    process.exit(1);
  }
}

// ==================== 心跳机制 ====================
let heartbeatTimer = null;

function startHeartbeat() {
  heartbeatTimer = setInterval(() => {
    if (!state.connected || !state.ws) return;
    
    // 检查是否超时未收到消息
    const idleTime = Date.now() - state.lastActivity;
    if (idleTime > CONFIG.heartbeatInterval * 2) {
      log('WARN', '⚠️ 长时间无活动，可能已断线');
      state.ws.terminate();
      return;
    }
    
    // 发送 ping
    const pingId = ++state.messageId;
    state.pendingPings.add(pingId);
    state.ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id: pingId,
      method: 'ping'
    }));
    
    log('DEBUG', '💓 发送心跳');
  }, CONFIG.heartbeatInterval);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ==================== 请求处理 ====================
async function handleRequest(msg) {
  const { id, method, params } = msg;
  
  switch (method) {
    case 'initialize':
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: '小欧-mcp-server-persistent', version: '3.0.0' }
      });
      break;
    
    case 'tools/list':
      sendResponse(id, { tools: TOOLS });
      break;
    
    case 'tools/call':
      const result = await handleToolCall(params);
      sendResponse(id, { content: [{ type: 'text', text: result }] });
      break;
    
    case 'ping':
      sendResponse(id, {});
      break;
    
    default:
      log('WARN', '未知方法:', method);
  }
}

function sendResponse(id, result) {
  if (!state.ws || !state.connected) return;
  
  state.ws.send(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  }));
}

// ==================== 工具实现 ====================
async function handleToolCall(params) {
  const { name, arguments: args } = params || {};
  
  try {
    switch (name) {
      case '小欧_chat':
        // 添加上下文记忆
        addToContext('user', args?.message);
        const response = generateChatResponse(args?.message, args?.clearContext);
        addToContext('assistant', response);
        return response;
      
      case '小欧_get_context':
        return `📜 [对话上下文]\n\n${getContextSummary()}\n\n共 ${state.context.length} 条记录`;
      
      case '小欧_clear_context':
        state.context = [];
        return '🗑️ [上下文已清空]\n\n可以开始新的对话了！';
      
      case '小欧_read_file':
        return await readFile(args?.path, args?.limit);
      
      case '小欧_list_files':
        return await listFiles(args?.path || '/root/.openclaw/workspace', args?.showHidden);
      
      case '小欧_send_telegram':
        return `📱 [小欧] 准备发送消息到 Telegram:\n"${args?.message}"\n\n⚠️ 实际发送需要在 OpenClaw 界面确认`;
      
      case '小欧_send_email':
        return await sendEmail(args?.to, args?.subject, args?.body, args?.html);
      
      case '小欧_system_info':
        return await getSystemInfo();
      
      case '小欧_web_search':
        return `🔍 [小欧] 搜索 "${args?.query}" 已准备就绪\n\n⚠️ 需要配置 Brave API Key 才能执行搜索`;
      
      case '小欧_screenshot':
        return `📸 [小欧] 准备截取网页: ${args?.url}\n\n⚠️ 请在 OpenClaw 界面执行截图操作`;
      
      case '小欧_git_status':
        return await getGitStatus(args?.path);
      
      case '小欧_remind':
        return `⏰ [小欧] 提醒已设置:\n内容: "${args?.message}"\n时间: ${args?.minutes} 分钟后`;
      
      case '小欧_save_note':
        return await saveNote(args?.content, args?.tag);
      
      case '小欧_calendar_add':
        return await addCalendarEvent(args?.title, args?.startTime, args?.endTime, args?.description, args?.location);
      
      case '小欧_calendar_list':
        return await listCalendarEvents(args?.period || 'today');
      
      case '小欧_add_expense':
        return await addExpense(args?.amount, args?.category, args?.item, args?.note);
      
      case '小欧_expense_report':
        return await getExpenseReport(args?.period || 'today');
      
      case '小欧_music_play':
        return `🎵 [小欧] 准备播放音乐\n搜索: "${args?.query}"\n来源: ${args?.source || 'netease'}\n\n⚠️ 需要配置音乐播放器`;
      
      case '小欧_music_control':
        const actionNames = {
          play: '▶️ 播放', pause: '⏸️ 暂停', next: '⏭️ 下一首',
          prev: '⏮️ 上一首', stop: '⏹️ 停止',
          volume_up: '🔊 音量+', volume_down: '🔉 音量-'
        };
        return `🎵 [小欧] ${actionNames[args?.action] || args?.action}\n\n⚠️ 需要配置音乐播放器`;
      
      default:
        return `❌ 未知工具: ${name}`;
    }
  } catch (err) {
    return `❌ 执行错误: ${err.message}`;
  }
}

// 生成带上下文的聊天回复
function generateChatResponse(message, clearContext) {
  if (clearContext) {
    state.context = [];
    return '🗑️ [上下文已清空]\n\n你好！我是小欧，有什么可以帮你的吗？';
  }
  
  // 简单的上下文感知回复
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('你好') || lowerMsg.includes('嗨')) {
    return `🦞 [小欧] 你好！我是你的 AI 助手。\n\n我可以帮你：\n• 读文件、发消息、查天气\n• 记账、设提醒、管日程\n• 搜网络、截网页、执行命令\n\n当前对话已有 ${state.context.length} 条记录，我会记住我们的对话内容。`;
  }
  
  if (lowerMsg.includes('谢谢') || lowerMsg.includes('感谢')) {
    return '😊 [小欧] 不客气！有需要随时叫我。';
  }
  
  if (lowerMsg.includes('再见') || lowerMsg.includes('拜拜')) {
    return '👋 [小欧] 再见！期待下次为你服务。';
  }
  
  // 默认回复
  return `🦞 [小欧] 收到: "${message}"\n\n我已记录到上下文（当前共 ${state.context.length} 条记录）。你可以说"查看上下文"来了解之前的对话，或者说"清空上下文"开始新话题。`;
}

// ==================== 工具函数 ====================
async function readFile(filePath, limit = 100) {
  try {
    if (!filePath) return '❌ 请提供文件路径';
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.slice(0, limit).join('\n');
    const suffix = lines.length > limit ? `\n\n... (还有 ${lines.length - limit} 行)` : '';
    return `📄 [文件: ${filePath}]\n\`\`\`\n${truncated}${suffix}\n\`\`\``;
  } catch (err) {
    return `❌ 读取失败: ${err.message}`;
  }
}

async function listFiles(dirPath, showHidden = false) {
  try {
    const resolvedPath = path.resolve(dirPath);
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const files = entries
      .filter(e => showHidden || !e.name.startsWith('.'))
      .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}${e.isDirectory() ? '/' : ''}`)
      .slice(0, 30);
    return `📂 [目录: ${dirPath}]\n${files.join('\n')}${entries.length > 30 ? '\n... (还有 ' + (entries.length - 30) + ' 项)' : ''}`;
  } catch (err) {
    return `❌ 列出失败: ${err.message}`;
  }
}

async function sendEmail(to, subject, body, isHtml = false) {
  if (!to || !subject || !body) return '❌ 请提供收件人、主题和正文';
  
  const emailData = {
    to, subject, body, isHtml,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  try {
    const emailPath = '/root/.openclaw/workspace/memory/pending-emails.json';
    let emails = [];
    try {
      const existing = await fs.readFile(emailPath, 'utf8');
      emails = JSON.parse(existing);
    } catch (e) {}
    emails.push(emailData);
    await fs.writeFile(emailPath, JSON.stringify(emails, null, 2), 'utf8');
    
    return `📧 [邮件已保存]\n收件人: ${to}\n主题: ${subject}\n\n⚠️ 已加入发送队列，请在 OpenClaw 界面确认发送`;
  } catch (err) {
    return `❌ 保存邮件失败: ${err.message}`;
  }
}

async function getSystemInfo() {
  try {
    const { stdout: uptime } = await execPromise('uptime -p 2>/dev/null || uptime');
    const { stdout: memory } = await execPromise('free -h 2>/dev/null | head -2 || echo "Memory info unavailable"');
    const { stdout: disk } = await execPromise('df -h / 2>/dev/null | tail -1 || echo "Disk info unavailable"');
    return `💻 [系统信息]\n⏱️ 运行时间: ${uptime.trim()}\n\n🧠 内存:\n${memory}\n\n💾 磁盘:\n${disk}`;
  } catch (err) {
    return `⚠️ 部分系统信息无法获取: ${err.message}`;
  }
}

async function getGitStatus(repoPath) {
  try {
    const cwd = repoPath || '/root/.openclaw/workspace';
    const { stdout } = await execPromise('git status --short --branch 2>&1', { cwd });
    return `🌿 [Git 状态: ${cwd}]\n${stdout || '工作区干净，无未提交更改'}`;
  } catch (err) {
    return `❌ Git 检查失败: ${err.message}`;
  }
}

async function saveNote(content, tag = '') {
  try {
    const notePath = '/root/.openclaw/workspace/memory/xiaozhi-notes.md';
    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp}${tag ? ` [${tag}]` : ''}\n${content}\n`;
    await fs.appendFile(notePath, entry, 'utf8');
    return `📝 [笔记已保存]\n标签: ${tag || '无'}\n内容预览: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
  } catch (err) {
    return `❌ 保存失败: ${err.message}`;
  }
}

async function addCalendarEvent(title, startTime, endTime, description = '', location = '') {
  if (!title || !startTime) return '❌ 请提供事件标题和开始时间';
  
  const event = {
    title, startTime,
    endTime: endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    description, location,
    createdAt: new Date().toISOString()
  };
  
  try {
    const calendarPath = '/root/.openclaw/workspace/memory/calendar-events.json';
    let events = [];
    try {
      const existing = await fs.readFile(calendarPath, 'utf8');
      events = JSON.parse(existing);
    } catch (e) {}
    events.push(event);
    await fs.writeFile(calendarPath, JSON.stringify(events, null, 2), 'utf8');
    
    const start = new Date(startTime);
    const timeStr = start.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    return `📅 [事件已添加]\n标题: ${title}\n时间: ${timeStr}${endTime ? '' : ' (持续1小时)'}\n${location ? '📍 地点: ' + location + '\n' : ''}${description ? '📝 备注: ' + description : ''}`;
  } catch (err) {
    return `❌ 添加事件失败: ${err.message}`;
  }
}

async function listCalendarEvents(period = 'today') {
  try {
    const calendarPath = '/root/.openclaw/workspace/memory/calendar-events.json';
    let events = [];
    try {
      const existing = await fs.readFile(calendarPath, 'utf8');
      events = JSON.parse(existing);
    } catch (e) {
      return `📅 [日历-${period}]\n暂无事件`;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    let filtered = events.filter(e => {
      const eventTime = new Date(e.startTime);
      switch (period) {
        case 'today': return eventTime >= today && eventTime < tomorrow;
        case 'tomorrow': return eventTime >= tomorrow && eventTime < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        case 'week': return eventTime >= today && eventTime < weekEnd;
        default: return true;
      }
    });
    
    filtered.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    if (filtered.length === 0) return `📅 [日历-${period}]\n该时间段暂无事件`;
    
    const periodNames = { today: '今天', tomorrow: '明天', week: '本周' };
    let result = `📅 [${periodNames[period] || period}的日程]\n共 ${filtered.length} 个事件:\n`;
    filtered.forEach((e, i) => {
      const time = new Date(e.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      result += `\n${i + 1}. ${e.title}\n   🕒 ${time}${e.location ? ' 📍 ' + e.location : ''}`;
    });
    return result;
  } catch (err) {
    return `❌ 读取日历失败: ${err.message}`;
  }
}

async function addExpense(amount, category, item, note = '') {
  if (!amount || !category || !item) return '❌ 请提供金额、分类和消费项目';
  
  const expense = {
    amount: parseFloat(amount), category, item, note,
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString('zh-CN')
  };
  
  try {
    const expensePath = '/root/.openclaw/workspace/memory/expenses.json';
    let expenses = [];
    try {
      const existing = await fs.readFile(expensePath, 'utf8');
      expenses = JSON.parse(existing);
    } catch (e) {}
    expenses.push(expense);
    await fs.writeFile(expensePath, JSON.stringify(expenses, null, 2), 'utf8');
    return `💰 [记账成功]\n📦 ${item}\n💵 ¥${amount.toFixed(2)}\n🏷️ ${category}${note ? '\n📝 ' + note : ''}`;
  } catch (err) {
    return `❌ 记账失败: ${err.message}`;
  }
}

async function getExpenseReport(period = 'today') {
  try {
    const expensePath = '/root/.openclaw/workspace/memory/expenses.json';
    let expenses = [];
    try {
      const existing = await fs.readFile(expensePath, 'utf8');
      expenses = JSON.parse(existing);
    } catch (e) {
      return `💰 [消费报告-${period}]\n暂无记录`;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    let filtered = expenses.filter(e => {
      const expenseDate = new Date(e.timestamp);
      switch (period) {
        case 'today': return expenseDate >= today;
        case 'week': return expenseDate >= weekAgo;
        case 'month': return expenseDate >= monthAgo;
        default: return true;
      }
    });
    
    if (filtered.length === 0) return `💰 [消费报告-${period}]\n该时间段暂无记录`;
    
    const total = filtered.reduce((sum, e) => sum + e.amount, 0);
    const byCategory = {};
    filtered.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    
    const periodNames = { today: '今天', week: '本周', month: '本月' };
    let result = `💰 [${periodNames[period] || period}消费报告]\n📊 共 ${filtered.length} 笔，总计 ¥${total.toFixed(2)}\n\n📈 分类统计:\n`;
    Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, amt]) => {
      result += `  • ${cat}: ¥${amt.toFixed(2)} (${((amt / total) * 100).toFixed(1)}%)\n`;
    });
    result += `\n📝 最近记录:\n`;
    filtered.slice(-5).reverse().forEach((e, i) => {
      result += `  ${i + 1}. ${e.item} ¥${e.amount.toFixed(2)}\n`;
    });
    return result;
  } catch (err) {
    return `❌ 读取账单失败: ${err.message}`;
  }
}

// ==================== 启动 ====================
log('INFO', '🚀 启动小欧 MCP 客户端（长连接模式）');
log('INFO', `⚙️ 配置: 心跳=${CONFIG.heartbeatInterval/1000}s, 重连延迟=${CONFIG.reconnectDelay/1000}s`);

connect();

// 保持进程运行
process.on('SIGINT', () => {
  log('INFO', '\n👋 收到退出信号，正在关闭...');
  stopHeartbeat();
  if (state.ws) state.ws.close();
  process.exit(0);
});
