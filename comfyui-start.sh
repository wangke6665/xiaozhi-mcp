#!/bin/bash
# ComfyUI 快速启动脚本（复制到 /opt/ComfyUI 使用）

cd /opt/ComfyUI
source venv/bin/activate
python main.py --cpu --listen 0.0.0.0 --port 8188
