# ComfyUI + OpenClaw 集成指南

🦞 让你的 OpenClaw 助手可以调用 ComfyUI 进行 AI 绘图！

## 📦 已安装内容

| 组件 | 位置 | 状态 |
|------|------|------|
| ComfyUI | `/opt/ComfyUI` | ✅ 已安装 |
| ComfyUI MCP Server | `/root/.openclaw/workspace/comfyui-mcp-server.js` | ✅ 已配置 |
| 模型下载脚本 | `/root/.openclaw/workspace/comfyui-download-models.sh` | ✅ 已准备 |

## 🚀 快速启动

### 1. 启动 ComfyUI

```bash
# CPU 模式（当前服务器无 GPU）
/opt/ComfyUI/start-cpu.sh

# 或后台运行
cd /opt/ComfyUI
source venv/bin/activate
nohup python main.py --cpu --listen 0.0.0.0 --port 8188 > comfyui.log 2>&1 &
```

**Web 界面：** http://你的服务器 IP:8188

### 2. 下载模型

```bash
# 执行下载脚本
cd /root/.openclaw/workspace
./comfyui-download-models.sh
```

**推荐下载：** SDXL Turbo（对 CPU 友好，速度快）

### 3. 配置环境变量

```bash
# 添加到 ~/.bashrc 或当前会话
export COMFYUI_URL=http://127.0.0.1:8188
```

### 4. 在 OpenClaw 中使用

现在你的 OpenClaw 助手可以调用以下工具：

- `generate_image` - 生成图片
- `get_queue_status` - 查看队列状态
- `list_models` - 列出可用模型

**示例对话：**
```
帮我画一只可爱的猫
生成一张赛博朋克风格的城市图片
ComfyUI 现在有什么模型可用？
```

## 🎨 可用工具

### generate_image

生成 AI 图片。

**参数：**
- `prompt` (必需)：正向提示词
- `negative_prompt` (可选)：负向提示词，默认 "nsfw, low quality, worst quality"
- `steps` (可选)：采样步数，默认 20
- `width` (可选)：图片宽度，默认 512
- `height` (可选)：图片高度，默认 512
- `seed` (可选)：随机种子，-1 表示随机

**示例：**
```
生成一张图片，提示词是"a beautiful sunset over mountains"
画一个 1024x1024 的奇幻城堡，50 步采样
```

### get_queue_status

查看当前 ComfyUI 队列状态。

### list_models

列出可用的模型。

**参数：**
- `type` (可选)：模型类型 (checkpoints, loras, vae, 等)

## 📥 模型推荐

### CPU 模式推荐（速度快）

1. **SDXL Turbo** (~6GB)
   - 1-4 步即可出图
   - 适合快速迭代
   - 质量不错

2. **SD1.5** (~4GB)
   - 经典模型
   - 生态丰富
   - LoRA 支持好

### 下载命令

```bash
# SDXL Turbo（推荐）
wget -O /opt/ComfyUI/models/checkpoints/sd_xl_turbo_1.0_fp16.safetensors \
  https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors

# SD1.5
wget -O /opt/ComfyUI/models/checkpoints/v1-5-pruned-emaonly.ckpt \
  https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt
```

## ⚙️ 高级配置

### 后台服务（systemd）

创建 `/etc/systemd/system/comfyui.service`:

```ini
[Unit]
Description=ComfyUI AI Drawing Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ComfyUI
Environment="PATH=/opt/ComfyUI/venv/bin"
ExecStart=/opt/ComfyUI/venv/bin/python main.py --cpu --listen 0.0.0.0 --port 8188
Restart=always

[Install]
WantedBy=multi-user.target
```

然后：
```bash
sudo systemctl daemon-reload
sudo systemctl enable comfyui
sudo systemctl start comfyui
```

### 多用户模式

```bash
python main.py --cpu --listen 0.0.0.0 --port 8188 --multi-user
```

## 🐛 故障排查

### ComfyUI 无法启动

```bash
# 检查端口是否被占用
netstat -tlnp | grep 8188

# 查看日志
tail -f /opt/ComfyUI/comfyui.log
```

### MCP 服务器无法连接

```bash
# 测试 ComfyUI 是否可访问
curl http://127.0.0.1:8188/system_stats

# 检查 MCP 配置
cat /root/.openclaw/workspace/config/mcporter.json
```

### 模型不显示

```bash
# 刷新模型列表
# 在 ComfyUI Web UI 中点击"Refresh"按钮

# 或重启 ComfyUI
sudo systemctl restart comfyui
```

## 📝 注意事项

- ⚠️ **CPU 模式速度慢** - 一张图可能需要 1-5 分钟
- 💾 **磁盘空间** - 每个模型 2-7GB
- 🔌 **保持 ComfyUI 运行** - MCP 服务器需要连接 ComfyUI
- 🌐 **防火墙** - 如需外部访问，开放 8188 端口

---

🦞 Have fun drawing!
