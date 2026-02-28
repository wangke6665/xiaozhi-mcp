#!/usr/bin/env node
/**
 * ComfyUI MCP Server for OpenClaw
 * 提供 AI 绘图能力
 */

const http = require('http');

const COMFYUI_URL = process.env.COMFYUI_URL || 'http://127.0.0.1:8188';

const serverInfo = {
  name: 'comfyui-mcp',
  version: '1.0.0',
  description: 'ComfyUI AI 绘图服务'
};

const tools = [
  {
    name: 'generate_image',
    description: '使用 ComfyUI 生成图片',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: '正向提示词' },
        negative_prompt: { type: 'string', description: '负向提示词', default: 'nsfw, low quality, worst quality' },
        steps: { type: 'number', description: '采样步数', default: 20 },
        width: { type: 'number', description: '图片宽度', default: 512 },
        height: { type: 'number', description: '图片高度', default: 512 },
        seed: { type: 'number', description: '随机种子', default: -1 }
      },
      required: ['prompt']
    }
  },
  {
    name: 'get_queue_status',
    description: '获取 ComfyUI 队列状态',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'list_models',
    description: '列出可用的模型',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: '模型类型：checkpoints, loras, vae, etc.', default: 'checkpoints' }
      }
    }
  }
];

async function comfyRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, COMFYUI_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function generateImage(params) {
  const { prompt, negative_prompt = 'nsfw, low quality, worst quality', steps = 20, width = 512, height = 512, seed = -1 } = params;

  // 获取模型列表
  const models = await comfyRequest('/api/models');
  const checkpoints = models.checkpoints || [];
  const checkpoint = checkpoints[0] || 'put_checkpoints_here';

  // 构建基础工作流
  const workflow = {
    "3": {
      "class_type": "KSampler",
      "inputs": {
        "cfg": 8,
        "denoise": 1,
        "latent_image": ["5", 0],
        "model": ["4", 0],
        "negative": ["7", 0],
        "positive": ["6", 0],
        "sampler_name": "euler",
        "scheduler": "normal",
        "seed": seed === -1 ? Math.floor(Math.random() * 2147483647) : seed,
        "steps": steps
      }
    },
    "4": {
      "class_type": "CheckpointLoaderSimple",
      "inputs": { "ckpt_name": checkpoint }
    },
    "5": {
      "class_type": "EmptyLatentImage",
      "inputs": { "batch_size": 1, "height": height, "width": width }
    },
    "6": {
      "class_type": "CLIPTextEncode",
      "inputs": { "clip": ["4", 1], "text": prompt }
    },
    "7": {
      "class_type": "CLIPTextEncode",
      "inputs": { "clip": ["4", 1], "text": negative_prompt }
    },
    "8": {
      "class_type": "VAEDecode",
      "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
    },
    "9": {
      "class_type": "SaveImage",
      "inputs": { "filename_prefix": "ComfyUI", "images": ["8", 0] }
    }
  };

  // 提交工作流
  const result = await comfyRequest('/prompt', 'POST', { prompt: workflow });
  
  return {
    success: true,
    prompt_id: result.prompt_id,
    message: `任务已提交，使用模型：${checkpoint}`,
    workflow: workflow
  };
}

async function handleToolCall(name, args) {
  try {
    switch (name) {
      case 'generate_image':
        return await generateImage(args);
      case 'get_queue_status':
        return await comfyRequest('/queue');
      case 'list_models':
        const models = await comfyRequest('/api/models');
        const type = args.type || 'checkpoints';
        return { [type]: models[type] || [] };
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (error) {
    return { error: error.message };
  }
}

// MCP stdio 服务器
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data) => {
  const lines = data.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      handleRequest(msg);
    } catch (e) {}
  }
});

async function handleRequest(msg) {
  let response;
  
  switch (msg.method) {
    case 'initialize':
      response = {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: serverInfo
        }
      };
      break;
      
    case 'tools/list':
      response = {
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools }
      };
      break;
      
    case 'tools/call':
      const result = await handleToolCall(msg.params.name, msg.params.arguments || {});
      response = {
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      };
      break;
      
    default:
      response = {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: `Method not found: ${msg.method}` }
      };
  }
  
  console.log(JSON.stringify(response));
});

console.error('🎨 ComfyUI MCP Server started');
console.error(`📡 ComfyUI URL: ${COMFYUI_URL}`);
