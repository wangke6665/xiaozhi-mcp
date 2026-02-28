#!/usr/bin/env node
/**
 * 小智 AI MCP WebSocket 桥接器
 */

const WebSocket = require('ws');

const HARDCODED_URL = 'wss://api.xiaozhi.me/mcp/?token=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjgwODYzMiwiYWdlbnRJZCI6MTUwNzQzMywiZW5kcG9pbnRJZCI6ImFnZW50XzE1MDc0MzMiLCJwdXJwb3NlIjoibWNwLWVuZHBvaW50IiwiaWF0IjoxNzcyMTY0NjY3LCJleHAiOjE4MDM3MjIyNjd9.oIsr5MlphfNMap7VcMsBzTShiXRk-z5fzFolDoWZho25dGL-B0RxnaGlCECLQRzJWFWdtgkATWtISXc0XwFrYQ';
const url = process.env.XIAOZHI_MCP_URL || HARDCODED_URL;

const ws = new WebSocket(url, { handshakeTimeout: 10000 });

let messageId = 1000;
const idMap = new Map(); // 内部ID -> 原始ID
const reverseIdMap = new Map(); // 原始ID -> 内部ID
let clientInitRequest = null;
let serverCapabilities = null;
let initialized = false;

function sendStdout(msg) {
  console.log(JSON.stringify(msg));
}

function sendWs(msg) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// 处理 stdin - 来自 mcporter 的请求
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  const lines = data.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    try {
      const msg = JSON.parse(trimmed);
      
      // 保存初始化请求
      if (msg.method === 'initialize') {
        clientInitRequest = msg;
        // 如果已经知道服务器能力，立即回复
        if (serverCapabilities) {
          sendStdout({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: serverCapabilities.capabilities || {},
              serverInfo: serverCapabilities.clientInfo || { name: 'xiaozhi-ai', version: '1.0' }
            }
          });
          initialized = true;
        }
        continue;
      }
      
      // 等待初始化完成
      if (!initialized && msg.method !== 'initialize') {
        // 缓存非初始化请求
        setTimeout(() => process.stdin.emit('data', line + '\n'), 100);
        continue;
      }
      
      // 映射 ID
      if (msg.id !== undefined) {
        const newId = ++messageId;
        idMap.set(newId, msg.id);
        reverseIdMap.set(msg.id, newId);
        msg.id = newId;
      }
      
      sendWs(msg);
    } catch (e) {}
  }
});

// 处理 WebSocket - 来自小智 AI 的消息
ws.on('message', (data) => {
  try {
    const msg = JSON.parse(data.toString());
    
    // 服务器发起初始化请求
    if (msg.method === 'initialize') {
      serverCapabilities = msg.params;
      
      // 回复服务器
      sendWs({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          serverInfo: { name: 'openclaw-bridge', version: '1.0.0' }
        }
      });
      
      // 如果有待处理的客户端初始化请求，现在回复
      if (clientInitRequest && !initialized) {
        sendStdout({
          jsonrpc: '2.0',
          id: clientInitRequest.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: serverCapabilities.capabilities || {},
            serverInfo: serverCapabilities.clientInfo || { name: 'xiaozhi-ai', version: '1.0' }
          }
        });
        initialized = true;
      }
      return;
    }
    
    // 处理服务器的其他请求（如 tools/list）
    if (msg.method && msg.id !== undefined) {
      // 这是服务器发来的请求，需要回复
      // 但目前我们还不支持处理这些请求
      // 可以返回空结果
      if (msg.method === 'tools/list') {
        sendWs({
          jsonrpc: '2.0',
          id: msg.id,
          result: { tools: [] }
        });
        return;
      }
    }
    
    // 映射响应 ID 回原始值
    if (msg.id !== undefined && idMap.has(msg.id)) {
      msg.id = idMap.get(msg.id);
      idMap.delete(msg.id);
    }
    
    sendStdout(msg);
  } catch (e) {}
});

ws.on('error', (e) => { console.error('WS Error:', e.message); process.exit(1); });
ws.on('close', () => process.exit(0));
process.stdin.resume();
