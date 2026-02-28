#!/bin/bash
# ComfyUI 基础模型下载脚本
# 使用方法：./comfyui-download-models.sh

COMFYUI_MODELS="/opt/ComfyUI/models"

echo "🎨 ComfyUI 模型下载"
echo "=================="
echo ""

# 创建目录
mkdir -p $COMFYUI_MODELS/checkpoints
mkdir -p $COMFYUI_MODELS/vae
mkdir -p $COMFYUI_MODELS/loras

# 可选模型列表
cat << 'EOF'
可下载的模型：

1. SD1.5 基础模型 (~4GB)
   - stable-diffusion-v1-5.ckpt
   
2. SDXL Turbo (~6GB, 推荐 CPU 使用)
   - sd_xl_turbo_1.0_fp16.safetensors
   
3. VAE 修复模型
   - vae-ft-mse-840000-ema-pruned.ckpt

4. 实用 LoRA
   - various style LoRAs

EOF

read -p "要下载哪个模型？(1-4 或 all): " choice

download_model() {
  local url=$1
  local output=$2
  local name=$3
  
  echo ""
  echo "⬇️  下载：$name"
  echo "   URL: $url"
  echo "   保存至：$output"
  echo ""
  
  if command -v wget &> /dev/null; then
    wget -c -O "$output" "$url"
  elif command -v curl &> /dev/null; then
    curl -L -o "$output" "$url"
  else
    echo "❌ 需要安装 wget 或 curl"
    return 1
  fi
  
  if [ $? -eq 0 ]; then
    echo "✅ 下载完成：$name"
  else
    echo "❌ 下载失败：$name"
  fi
}

case $choice in
  1)
    download_model \
      "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt" \
      "$COMFYUI_MODELS/checkpoints/v1-5-pruned-emaonly.ckpt" \
      "Stable Diffusion 1.5"
    ;;
  2)
    download_model \
      "https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors" \
      "$COMFYUI_MODELS/checkpoints/sd_xl_turbo_1.0_fp16.safetensors" \
      "SDXL Turbo (推荐 CPU)"
    ;;
  3)
    download_model \
      "https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.ckpt" \
      "$COMFYUI_MODELS/vae/vae-ft-mse-840000-ema-pruned.ckpt" \
      "VAE ft-mse"
    ;;
  all)
    echo "开始批量下载..."
    download_model \
      "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt" \
      "$COMFYUI_MODELS/checkpoints/v1-5-pruned-emaonly.ckpt" \
      "Stable Diffusion 1.5"
    download_model \
      "https://huggingface.co/stabilityai/sd-vae-ft-mse-original/resolve/main/vae-ft-mse-840000-ema-pruned.ckpt" \
      "$COMFYUI_MODELS/vae/vae-ft-mse-840000-ema-pruned.ckpt" \
      "VAE ft-mse"
    ;;
  *)
    echo "无效选择"
    exit 1
    ;;
esac

echo ""
echo "✅ 模型下载完成！"
echo "   模型位置：$COMFYUI_MODELS"
