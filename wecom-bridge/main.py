"""
OpenClaw 企业微信桥接服务
接收OpenClaw消息并转发到企业微信
"""
import os
import sys
import yaml
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

from wecom_client import WeComClient

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 加载配置
config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
with open(config_path, 'r', encoding='utf-8') as f:
    config = yaml.safe_load(f)

# 初始化企业微信客户端
wecom_client = WeComClient(
    corpid=config['wecom']['corpid'],
    secret=config['wecom']['agent']['secret'],
    agentid=config['wecom']['agent']['agentid']
)

app = FastAPI(title="OpenClaw 企业微信桥接服务")


class MessageRequest(BaseModel):
    """消息请求模型"""
    message: str
    message_type: str = "text"  # text, markdown
    to_user: Optional[str] = None
    to_party: Optional[str] = None
    to_tag: Optional[str] = None
    use_webhook: bool = False


class WebhookPayload(BaseModel):
    """OpenClaw Webhook 载荷"""
    message: str
    channel: Optional[str] = None
    timestamp: Optional[float] = None
    metadata: Optional[dict] = None


@app.get("/")
async def root():
    """健康检查"""
    return {
        "service": "OpenClaw 企业微信桥接服务",
        "status": "running",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok"}


@app.post("/send")
async def send_message(req: MessageRequest):
    """发送消息到企业微信"""
    try:
        # 使用配置中的默认接收人，如果没有指定
        to_user = req.to_user or config['wecom'].get('to_user', '@all')
        to_party = req.to_party or config['wecom'].get('to_party', '')

        # 如果都没有配置，默认发给所有人
        if not to_user and not to_party:
            to_user = '@all'

        # 判断使用Webhook还是应用消息
        if req.use_webhook and config['wecom']['webhook']['enabled']:
            # 使用群机器人
            webhook_key = config['wecom']['webhook']['key']
            content = {
                "msgtype": "text",
                "text": {
                    "content": req.message
                }
            }
            result = wecom_client.send_webhook_message(webhook_key, content)
        else:
            # 使用应用消息
            if req.message_type == "markdown":
                result = wecom_client.send_markdown_message(
                    content=req.message,
                    to_user=to_user,
                    to_party=to_party,
                    to_tag=req.to_tag
                )
            else:
                result = wecom_client.send_text_message(
                    content=req.message,
                    to_user=to_user,
                    to_party=to_party,
                    to_tag=req.to_tag
                )

        if result.get("errcode") != 0:
            logger.error(f"发送消息失败: {result.get('errmsg')}")
            raise HTTPException(
                status_code=500,
                detail=f"发送消息失败: {result.get('errmsg')}"
            )

        logger.info(f"消息发送成功: {req.message[:50]}...")
        return {
            "success": True,
            "msgid": result.get("msgid"),
            "invaliduser": result.get("invaliduser", ""),
            "invalidparty": result.get("invalidparty", "")
        }

    except Exception as e:
        logger.error(f"发送消息异常: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/webhook")
async def webhook_handler(payload: WebhookPayload, request: Request):
    """
    OpenClaw Webhook 接收端
    OpenClaw可以通过此接口推送消息到企业微信
    """
    try:
        # 验证secret（如果配置了）
        secret = config.get('openclaw', {}).get('secret')
        if secret:
            provided_secret = request.headers.get('X-Webhook-Secret')
            if provided_secret != secret:
                raise HTTPException(status_code=401, detail="未授权的请求")

        # 使用配置中的默认接收人，默认发给所有人
        to_user = config['wecom'].get('to_user', '@all') or '@all'
        to_party = config['wecom'].get('to_party', '')

        # 发送消息
        result = wecom_client.send_text_message(
            content=payload.message,
            to_user=to_user,
            to_party=to_party
        )

        if result.get("errcode") != 0:
            logger.error(f"Webhook消息转发失败: {result.get('errmsg')}")
            return {"success": False, "error": result.get('errmsg')}

        logger.info(f"Webhook消息转发成功: {payload.message[:50]}...")
        return {"success": True, "msgid": result.get("msgid")}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Webhook处理异常: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


def start_server():
    """启动服务"""
    server_config = config.get('server', {})
    host = server_config.get('host', '0.0.0.0')
    port = server_config.get('port', 8900)
    debug = server_config.get('debug', False)

    logger.info(f"启动企业微信桥接服务: http://{host}:{port}")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )


if __name__ == "__main__":
    start_server()