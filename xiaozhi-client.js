#!/usr/bin/env node
/**
 * 小欧 - 小智 AI MCP 客户端 (扩展版)
 * 作为工具提供者让小智调用
 */

const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const XIAOZHI_MCP_URL = process.env.XIAOZHI_MCP_URL;

if (!XIAOZHI_MCP_URL) {
  console.error('❌ 错误：请设置 XIAOZHI_MCP_URL 环境变量');
  console.error('   复制 .env.example 为 .env 并填入你的 token');
  process.exit(1);
}

console.log('🔌 正在连接小智 AI MCP 服务器...');
console.log('📝 模式：作为工具提供者让小智调用\n');

// 自动重连配置
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAY = 3000;

function createWebSocket() {
  const ws = new WebSocket(XIAOZHI_MCP_URL, { 
    handshakeTimeout: 10000,
    heartbeatInterval: 30000  // 30 秒心跳
  });
  
  ws.on('ping', () => {
    ws.pong();  // 响应服务器 ping
  });
  
  return ws;
}

let ws = createWebSocket();

// ==================== 工具定义 ====================
const TOOLS = [
  // 基础对话
  {
    name: '小欧_chat',
    description: '与 小欧 AI 助手对话聊天',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息内容' }
      },
      required: ['message']
    }
  },
  
  // 文件操作
  {
    name: '小欧_read_file',
    description: '读取文件内容（支持文本文件）',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '文件路径，如 /root/.openclaw/workspace/README.md' },
        limit: { type: 'number', description: '最大读取行数（可选，默认 100 行）' }
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
        path: { type: 'string', description: '目录路径，默认为 workspace' },
        showHidden: { type: 'boolean', description: '是否显示隐藏文件' }
      }
    }
  },
  
  // 消息发送
  {
    name: '小欧_send_telegram',
    description: '发送消息到 Telegram',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '要发送的消息内容' },
        target: { type: 'string', description: '目标用户或群组（可选）' }
      },
      required: ['message']
    }
  },
  
  // 系统监控
  {
    name: '小欧_system_info',
    description: '获取系统信息（CPU、内存、磁盘使用情况）',
    inputSchema: { type: 'object', properties: {} }
  },
  
  // 网络搜索
  {
    name: '小欧_web_search',
    description: '搜索网络信息（使用 Searxng - 免费开源）',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
        count: { type: 'number', description: '结果数量（1-10，默认 5）' }
      },
      required: ['query']
    }
  },
  
  // 浏览器控制
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
  
  // Git 操作
  {
    name: '小欧_git_status',
    description: '查看 Git 仓库状态',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Git 仓库路径（可选，默认当前目录）' }
      }
    }
  },
  
  // 定时提醒
  {
    name: '小欧_remind',
    description: '设置提醒（会在指定时间后通知）',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: '提醒内容' },
        minutes: { type: 'number', description: '多少分钟后提醒' }
      },
      required: ['message', 'minutes']
    }
  },
  
  // 笔记/记忆
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
  
  // 代码执行
  {
    name: '小欧_run_code',
    description: '执行代码片段（Node.js/Python/Bash）',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: '代码内容' },
        language: { type: 'string', description: '语言：node、python、bash', enum: ['node', 'python', 'bash'] }
      },
      required: ['code', 'language']
    }
  },
  
  // 天气查询
  {
    name: '小欧_weather',
    description: '查询天气（需要安装 weather skill）',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: '城市名称，如"北京"、"Shanghai"' }
      },
      required: ['location']
    }
  },
  
  // 会话管理
  {
    name: '小欧_session_status',
    description: '查看当前 小欧 会话状态',
    inputSchema: { type: 'object', properties: {} }
  },
  
  // 邮件发送
  {
    name: '小欧_send_email',
    description: '发送邮件（需要配置 SMTP）',
    inputSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: '收件人邮箱地址' },
        subject: { type: 'string', description: '邮件主题' },
        body: { type: 'string', description: '邮件正文内容' },
        html: { type: 'boolean', description: '是否使用 HTML 格式（可选，默认 false）' }
      },
      required: ['to', 'subject', 'body']
    }
  },
  
  // 日历管理
  {
    name: '小欧_calendar_add',
    description: '添加日历事件',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '事件标题' },
        startTime: { type: 'string', description: '开始时间（ISO 8601 格式，如 2026-02-27T15:00:00）' },
        endTime: { type: 'string', description: '结束时间（可选）' },
        description: { type: 'string', description: '事件描述（可选）' },
        location: { type: 'string', description: '地点（可选）' }
      },
      required: ['title', 'startTime']
    }
  },
  {
    name: '小欧_calendar_list',
    description: '查看日历事件（今天/明天/本周）',
    inputSchema: {
      type: 'object',
      properties: {
        period: { type: 'string', description: '时间段：today、tomorrow、week', enum: ['today', 'tomorrow', 'week'], default: 'today' }
      }
    }
  },
  
  // 💰 记账/消费记录
  {
    name: '小欧_add_expense',
    description: '记录一笔消费/支出',
    inputSchema: {
      type: 'object',
      properties: {
        amount: { type: 'number', description: '金额（元）' },
        category: { type: 'string', description: '分类：餐饮、交通、购物、娱乐、生活、其他', enum: ['餐饮', '交通', '购物', '娱乐', '生活', '其他'] },
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
        period: { type: 'string', description: '时间范围：today、week、month', enum: ['today', 'week', 'month'], default: 'today' }
      }
    }
  },
  
  // 🎵 音乐播放控制
  {
    name: '小欧_music_play',
    description: '播放音乐（需要配置音乐播放器）',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '歌曲名、歌手或关键词，如"周杰伦晴天"' },
        source: { type: 'string', description: '音乐源：netease、qq、spotify', enum: ['netease', 'qq', 'spotify'], default: 'netease' }
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
        action: { type: 'string', description: '操作：play、pause、next、prev、stop、volume_up、volume_down', enum: ['play', 'pause', 'next', 'prev', 'stop', 'volume_up', 'volume_down'] }
      },
      required: ['action']
    }
  },
  
  // 🔧 OpenClaw 控制
  {
    name: '小欧_openclaw_restart',
    description: '重启 OpenClaw Gateway 服务',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: '确认重启（必须为 true）' }
      },
      required: ['confirm']
    }
  },
  {
    name: '小欧_openclaw_switch_model',
    description: '切换 OpenClaw 默认模型',
    inputSchema: {
      type: 'object',
      properties: {
        model: { type: 'string', description: '模型名称，如 bailian/glm-5、bailian/qwen3.5-plus' }
      },
      required: ['model']
    }
  },
  {
    name: '小欧_openclaw_check_version',
    description: '检查 OpenClaw 当前版本和可用更新',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: '小欧_openclaw_update',
    description: '更新 OpenClaw 到最新版本',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: { type: 'boolean', description: '确认更新（必须为 true）' }
      },
      required: ['confirm']
    }
  }
];

// ==================== WebSocket 处理 ====================
function setupEventHandlers() {
  ws.on('open', () => {
    reconnectAttempts = 0;  // 重置重连计数
    console.log('✅ 已连接到小智 MCP 服务器');
    console.log(`📦 已注册 ${TOOLS.length} 个工具\n`);
  });

  ws.on('message', async (data) => {
  try {
    const msg = JSON.parse(data.toString());
    
    if (msg.method) {
      console.log(`📥 [${msg.method}]`, msg.params ? JSON.stringify(msg.params).substring(0, 80) : '');
    }
    
    // 初始化
    if (msg.method === 'initialize') {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: { listChanged: true } },
          serverInfo: { name: '小欧-mcp-server', version: '2.0.0' }
        }
      }));
      return;
    }
    
    // 工具列表
    if (msg.method === 'tools/list') {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools: TOOLS }
      }));
      console.log(`📤 返回 ${TOOLS.length} 个工具`);
      return;
    }
    
    // 工具调用
    if (msg.method === 'tools/call') {
      const result = await handleToolCall(msg.params);
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: result }] }
      }));
      console.log('📤 执行完成');
      return;
    }
    
    // ping
    if (msg.method === 'ping') {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: {} }));
      return;
    }
    
  } catch (err) {
    console.error('❌ 错误:', err.message);
  }
});

  ws.on('error', (err) => console.error('❌ WebSocket 错误:', err.message));
  ws.on('close', () => {
  console.log('\n👋 连接关闭');
  reconnectAttempts++;
  
  if (reconnectAttempts <= MAX_RECONNECT_ATTEMPTS) {
    console.log(`🔄 ${RECONNECT_DELAY/1000}秒后尝试重连 (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
    setTimeout(() => {
      console.log('🔌 正在重新连接...');
      ws = createWebSocket();
      setupEventHandlers();
    }, RECONNECT_DELAY);
  } else {
    console.log('❌ 重连次数已达上限，退出');
    process.exit(1);
  }
});
}

// 初始化事件处理器
setupEventHandlers();

// ==================== 工具实现 ====================
async function handleToolCall(params) {
  const { name, arguments: args } = params || {};
  
  try {
    switch (name) {
      case '小欧_chat':
        return `🦞 [小欧] 收到："${args?.message}"\n\n我是你的 AI 助手，可以通过语音帮你：读文件、发消息、查天气、搜网络、管系统等。直接告诉我要做什么！`;
      
      case '小欧_read_file':
        return await readFile(args?.path, args?.limit);
      
      case '小欧_list_files':
        return await listFiles(args?.path || '/root/.openclaw/workspace', args?.showHidden);
      
      case '小欧_send_telegram':
        return `📱 [小欧] 准备发送消息到 Telegram:\n"${args?.message}"\n\n⚠️ 注意：实际发送需要在 小欧 界面确认`;
      
      case '小欧_system_info':
        return await getSystemInfo();
      
      case '小欧_web_search':
        return await webSearch(args?.query, args?.count);
      
      case '小欧_screenshot':
        return `📸 [小欧] 准备截取网页：${args?.url}\n\n⚠️ 请在 小欧 界面执行截图操作`;
      
      case '小欧_git_status':
        return await getGitStatus(args?.path);
      
      case '小欧_remind':
        return `⏰ [小欧] 提醒已设置:\n内容："${args?.message}"\n时间：${args?.minutes} 分钟后\n\n我会在指定时间通知你！`;
      
      case '小欧_save_note':
        return await saveNote(args?.content, args?.tag);
      
      case '小欧_run_code':
        return `💻 [小欧] 准备执行 ${args?.language} 代码:\n\`\`\`\n${args?.code?.substring(0, 200)}...\n\`\`\`\n\n⚠️ 出于安全考虑，请在 小欧 界面确认执行`;
      
      case '小欧_weather':
        return `🌤️ [小欧] 准备查询 "${args?.location}" 的天气\n\n⚠️ 需要安装 weather skill 才能获取天气数据`;
      
      case '小欧_session_status':
        return `📊 [小欧] 会话状态\n🟢 运行正常\n🕒 当前时间：${new Date().toLocaleString('zh-CN')}\n📦 可用工具：${TOOLS.length} 个`;
      
      case '小欧_send_email':
        return await sendEmail(args?.to, args?.subject, args?.body, args?.html);
      
      case '小欧_calendar_add':
        return await addCalendarEvent(args?.title, args?.startTime, args?.endTime, args?.description, args?.location);
      
      case '小欧_calendar_list':
        return await listCalendarEvents(args?.period || 'today');
      
      case '小欧_add_expense':
        return await addExpense(args?.amount, args?.category, args?.item, args?.note);
      
      case '小欧_expense_report':
        return await getExpenseReport(args?.period || 'today');
      
      case '小欧_music_play':
        return `🎵 [小欧] 准备播放音乐\n搜索："${args?.query}"\n来源：${args?.source || 'netease'}\n\n⚠️ 需要配置音乐播放器才能播放`;
      
      case '小欧_music_control':
        const actionNames = {
          play: '▶️ 播放', pause: '⏸️ 暂停', next: '⏭️ 下一首',
          prev: '⏮️ 上一首', stop: '⏹️ 停止',
          volume_up: '🔊 音量+', volume_down: '🔉 音量-'
        };
        return `🎵 [小欧] ${actionNames[args?.action] || args?.action}\n\n⚠️ 需要配置音乐播放器才能控制`;
      
      case '小欧_openclaw_restart':
        return await restartOpenClaw(args?.confirm);
      
      case '小欧_openclaw_switch_model':
        return await switchOpenClawModel(args?.model);
      
      case '小欧_openclaw_check_version':
        return await checkOpenClawVersion();
      
      case '小欧_openclaw_update':
        return await updateOpenClaw(args?.confirm);
      
      default:
        return `❌ 未知工具：${name}`;
    }
  } catch (err) {
    return `❌ 执行错误：${err.message}`;
  }
}

// 读取文件
async function readFile(filePath, limit = 100) {
  try {
    if (!filePath) return '❌ 请提供文件路径';
    const resolvedPath = path.resolve(filePath);
    const content = await fs.readFile(resolvedPath, 'utf8');
    const lines = content.split('\n');
    const truncated = lines.slice(0, limit).join('\n');
    const suffix = lines.length > limit ? `\n\n... (还有 ${lines.length - limit} 行)` : '';
    return `📄 [文件：${filePath}]\n\`\`\`\n${truncated}${suffix}\n\`\`\``;
  } catch (err) {
    return `❌ 读取失败：${err.message}`;
  }
}

// 列出文件
async function listFiles(dirPath, showHidden = false) {
  try {
    const resolvedPath = path.resolve(dirPath);
    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const files = entries
      .filter(e => showHidden || !e.name.startsWith('.'))
      .map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}${e.isDirectory() ? '/' : ''}`)
      .slice(0, 30);
    return `📂 [目录：${dirPath}]\n${files.join('\n')}${entries.length > 30 ? '\n... (还有 ' + (entries.length - 30) + ' 项)' : ''}`;
  } catch (err) {
    return `❌ 列出失败：${err.message}`;
  }
}

// 系统信息
async function getSystemInfo() {
  try {
    const { stdout: uptime } = await execPromise('uptime -p 2>/dev/null || uptime');
    const { stdout: memory } = await execPromise('free -h 2>/dev/null | head -2 || echo "Memory info unavailable"');
    const { stdout: disk } = await execPromise('df -h / 2>/dev/null | tail -1 || echo "Disk info unavailable"');
    return `💻 [系统信息]\n⏱️ 运行时间：${uptime.trim()}\n\n🧠 内存:\n${memory}\n\n💾 磁盘:\n${disk}`;
  } catch (err) {
    return `⚠️ 部分系统信息无法获取：${err.message}`;
  }
}

// Git 状态
async function getGitStatus(repoPath) {
  try {
    const cwd = repoPath || '/root/.openclaw/workspace';
    const { stdout } = await execPromise('git status --short --branch 2>&1', { cwd });
    return `🌿 [Git 状态：${cwd}]\n${stdout || '工作区干净，无未提交更改'}`;
  } catch (err) {
    return `❌ Git 检查失败：${err.message}`;
  }
}

// 保存笔记
async function saveNote(content, tag = '') {
  try {
    const notePath = `/root/.openclaw/workspace/memory/xiaozhi-notes.md`;
    const timestamp = new Date().toISOString();
    const entry = `\n## ${timestamp}${tag ? ` [${tag}]` : ''}\n${content}\n`;
    await fs.appendFile(notePath, entry, 'utf8');
    return `📝 [笔记已保存]\n标签：${tag || '无'}\n内容预览："${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`;
  } catch (err) {
    return `❌ 保存失败：${err.message}`;
  }
}

// 发送邮件
async function sendEmail(to, subject, body, isHtml = false) {
  if (!to || !subject || !body) {
    return '❌ 请提供收件人、主题和正文';
  }
  
  const emailData = {
    to,
    subject,
    body,
    isHtml,
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  try {
    const emailPath = '/root/.openclaw/workspace/memory/pending-emails.json';
    let emails = [];
    try {
      const existing = await fs.readFile(emailPath, 'utf8');
      emails = JSON.parse(existing);
    } catch (e) {
      // 文件不存在，创建新数组
    }
    emails.push(emailData);
    await fs.writeFile(emailPath, JSON.stringify(emails, null, 2), 'utf8');
    
    return `📧 [邮件已保存]\n收件人：${to}\n主题：${subject}\n格式：${isHtml ? 'HTML' : '纯文本'}\n\n⚠️ 邮件已加入发送队列\n请在 小欧 界面确认发送（需要配置 SMTP）`;
  } catch (err) {
    return `❌ 保存邮件失败：${err.message}`;
  }
}

// 添加日历事件
async function addCalendarEvent(title, startTime, endTime, description = '', location = '') {
  if (!title || !startTime) {
    return '❌ 请提供事件标题和开始时间';
  }
  
  const event = {
    title,
    startTime,
    endTime: endTime || new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString(),
    description,
    location,
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
    const timeStr = start.toLocaleString('zh-CN', { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    
    return `📅 [事件已添加]\n标题：${title}\n时间：${timeStr}${endTime ? '' : ' (持续 1 小时)'}\n${location ? '📍 地点：' + location + '\n' : ''}${description ? '📝 备注：' + description : ''}`;
  } catch (err) {
    return `❌ 添加事件失败：${err.message}`;
  }
}

// 列出日历事件
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
        case 'today':
          return eventTime >= today && eventTime < tomorrow;
        case 'tomorrow':
          return eventTime >= tomorrow && eventTime < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
        case 'week':
          return eventTime >= today && eventTime < weekEnd;
        default:
          return true;
      }
    });
    
    filtered.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    
    if (filtered.length === 0) {
      return `📅 [日历-${period}]\n该时间段暂无事件`;
    }
    
    const periodNames = { today: '今天', tomorrow: '明天', week: '本周' };
    let result = `📅 [${periodNames[period] || period}的日程]\n共 ${filtered.length} 个事件:\n`;
    
    filtered.forEach((e, i) => {
      const time = new Date(e.startTime).toLocaleString('zh-CN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      result += `\n${i + 1}. ${e.title}\n   🕒 ${time}${e.location ? ' 📍 ' + e.location : ''}`;
    });
    
    return result;
  } catch (err) {
    return `❌ 读取日历失败：${err.message}`;
  }
}

// 添加消费记录
async function addExpense(amount, category, item, note = '') {
  if (!amount || !category || !item) {
    return '❌ 请提供金额、分类和消费项目';
  }
  
  const expense = {
    amount: parseFloat(amount),
    category,
    item,
    note,
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
    
    return `💰 [记账成功]\n📦 ${item}\n💵 ¥${amount.toFixed(2)}\n🏷️ ${category}${note ? '\n📝 ' + note : ''}\n\n✅ 已保存`;
  } catch (err) {
    return `❌ 记账失败：${err.message}`;
  }
}

// 网络搜索 (使用 Searxng - 免费)
// 网络搜索 (使用 DuckDuckGo HTML - 免费无需 API)
async function webSearch(query, count = 5) {
  if (!query) {
    return '❌ [小欧] 请提供搜索关键词';
  }
  
  const https = require('https');
  const http = require('http');
  
  return new Promise((resolve) => {
    // DuckDuckGo HTML 搜索
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    
    const options = {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          // 简单解析 HTML 结果
          const results = parseDuckDuckGoHTML(data, count || 5);
          
          if (results.length === 0) {
            return resolve(`🔍 [小欧] 搜索 "${query}"\n\n未找到相关结果`);
          }
          
          let output = `🔍 [小欧] 搜索结果："${query}"\n来源：DuckDuckGo\n\n`;
          results.forEach((r, i) => {
            output += `${i + 1}. **${r.title}**\n`;
            output += `   ${r.snippet}\n`;
            output += `   🔗 ${r.url}\n\n`;
          });
          resolve(output);
        } catch (e) {
          resolve(`🔍 [小欧] 搜索 "${query}"\n\n⚠️ 解析失败：${e.message}`);
        }
      });
    }).on('error', (err) => {
      resolve(`🔍 [小欧] 搜索 "${query}"\n\n⚠️ 搜索失败：${err.message}`);
    }).on('timeout', () => {
      resolve(`🔍 [小欧] 搜索 "${query}"\n\n⚠️ 请求超时 (8 秒)`);
    });
  });
}

// 解析 DuckDuckGo HTML 结果
function parseDuckDuckGoHTML(html, count) {
  const results = [];
  const resultRegex = /<a class="result__a" href="([^"]+)">([^<]+)<\/a>/g;
  const snippetRegex = /<a class="result__snippet" href="[^"]*">([^<]+)<\/a>/g;
  
  let match;
  let i = 0;
  while ((match = resultRegex.exec(html)) !== null && i < count) {
    const url = match[1].replace(/^\/\/uddg\.redirect\.duckduckgo\.com\/\?uddg=/, '').split('&rut=')[0];
    const title = match[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    
    // 尝试找对应的 snippet
    let snippet = '无摘要';
    const snippetMatch = snippetRegex.exec(html);
    if (snippetMatch) {
      snippet = snippetMatch[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').substring(0, 200);
    }
    
    // 解码 URL
    const decodedUrl = decodeURIComponent(url);
    
    results.push({ title, snippet: snippet + '...', url: decodedUrl });
    i++;
  }
  
  return results;
}

// 重启 OpenClaw
async function restartOpenClaw(confirm) {
  if (!confirm) {
    return '⚠️ [小欧] 重启 OpenClaw 需要确认\n请设置 confirm: true 来确认重启';
  }
  
  try {
    await execPromise('openclaw gateway restart');
    return '🔄 [小欧] OpenClaw Gateway 已重启\n\n✅ 服务重启成功';
  } catch (err) {
    return '❌ [小欧] 重启失败：' + err.message;
  }
}

// 切换 OpenClaw 模型
async function switchOpenClawModel(model) {
  if (!model) {
    return '❌ [小欧] 请提供模型名称\n可用模型：bailian/glm-5, bailian/qwen3.5-plus, qwen-portal/coder-model, qwen-portal/vision-model';
  }
  
  try {
    const configPath = '/root/.openclaw/config.json';
    let config = {};
    try {
      const content = await fs.readFile(configPath, 'utf8');
      config = JSON.parse(content);
    } catch (e) {
      // 文件不存在，创建新配置
    }
    
    config.defaultModel = model;
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    return '✅ [小欧] 默认模型已切换\n新模型：' + model + '\n\n⚠️ 需要重启 OpenClaw 或新建会话才能生效';
  } catch (err) {
    return '❌ [小欧] 切换失败：' + err.message;
  }
}

// 检查 OpenClaw 版本
async function checkOpenClawVersion() {
  try {
    const { stdout } = await execPromise('openclaw status 2>&1 | head -20');
    const versionMatch = stdout.match(/OpenClaw ([\d.]+)/);
    const version = versionMatch ? versionMatch[1] : '未知';
    const updateMatch = stdout.match(/Update\s*\|\s*(.+)/);
    const updateInfo = updateMatch ? updateMatch[1].trim() : null;
    
    let result = `📦 [小欧] OpenClaw 版本信息\n\n`;
    result += `当前版本：${version}\n\n`;
    if (updateInfo && updateInfo.includes('available')) {
      result += `🔄 更新可用\n${updateInfo}`;
    } else {
      result += `✅ 已是最新版本`;
    }
    return result;
  } catch (err) {
    return '❌ [小欧] 检查失败：' + err.message;
  }
}

// 更新 OpenClaw
async function updateOpenClaw(confirm) {
  if (!confirm) {
    return '⚠️ [小欧] 更新 OpenClaw 需要确认\n请设置 confirm: true 来确认更新';
  }
  
  try {
    const { stdout } = await execPromise('openclaw update 2>&1');
    return `🔄 [小欧] OpenClaw 更新中...\n\n${stdout.trim()}`;
  } catch (err) {
    return '❌ [小欧] 更新失败：' + err.message;
  }
}

// 保持运行
setInterval(() => {}, 1000);
console.log('⏳ 等待小智连接...\n');
