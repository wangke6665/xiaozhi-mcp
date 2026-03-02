"""
OpenClaw集成示例
在OpenClaw中发送消息到企业微信
"""
import requests
import json
from datetime import datetime


class WeComNotifier:
    """企业微信通知器"""

    def __init__(self, bridge_url="http://localhost:8900", secret=None):
        self.bridge_url = bridge_url
        self.webhook_url = f"{bridge_url}/webhook"
        self.send_url = f"{bridge_url}/send"
        self.secret = secret

    def notify(self, message, use_webhook=True):
        """
        发送通知消息

        Args:
            message: 消息内容
            use_webhook: 是否使用Webhook接口
        """
        try:
            if use_webhook:
                # 使用Webhook接口
                headers = {}
                if self.secret:
                    headers["X-Webhook-Secret"] = self.secret
                payload = {
                    "message": message,
                    "channel": "openclaw",
                    "timestamp": datetime.now().timestamp()
                }
                response = requests.post(self.webhook_url, json=payload, headers=headers, timeout=5)
            else:
                # 使用直接发送接口
                payload = {
                    "message": message,
                    "message_type": "text"
                }
                response = requests.post(self.send_url, json=payload, timeout=5)

            result = response.json()
            if result.get("success"):
                print(f"✅ 消息已发送到企业微信: {message[:30]}...")
                return True
            else:
                print(f"❌ 发送失败: {result.get('error')}")
                return False

        except Exception as e:
            print(f"❌ 发送异常: {e}")
            return False

    def notify_markdown(self, message):
        """发送Markdown格式消息"""
        try:
            payload = {
                "message": message,
                "message_type": "markdown"
            }
            response = requests.post(self.send_url, json=payload, timeout=5)
            result = response.json()
            return result.get("success", False)
        except Exception as e:
            print(f"发送Markdown消息失败: {e}")
            return False


# 使用示例
if __name__ == "__main__":
    # 初始化通知器
    notifier = WeComNotifier(
        bridge_url="http://localhost:8900",
        secret="webhook_secret_key"
    )

    # 发送文本消息
    notifier.notify("📢 OpenClaw集成测试成功！")

    # 发送Markdown消息
    md_message = """
# 🎉 API调用成功

**状态**: 成功
**时间**: 2026-03-02 16:30

### 详情
- Endpoint: /api/users
- Method: GET
- Response Time: 120ms

---
*由OpenClaw企业微信桥接服务自动发送*
"""
    notifier.notify_markdown(md_message)