"""
测试脚本 - 发送测试消息到企业微信
"""
import requests
import json

# 配置
BASE_URL = "http://localhost:8900"
WEBHOOK_SECRET = "webhook_secret_key"


def test_send_text():
    """测试发送文本消息"""
    print("测试1: 发送文本消息")
    url = f"{BASE_URL}/send"
    payload = {
        "message": "【测试】这是一条来自OpenClaw企业微信桥接服务的测试消息",
        "message_type": "text"
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return result.get("success", False)
    except Exception as e:
        print(f"失败: {e}")
        return False


def test_send_markdown():
    """测试发送Markdown消息"""
    print("\n测试2: 发送Markdown消息")
    url = f"{BASE_URL}/send"
    payload = {
        "message": """# OpenClaw通知

这是一条**Markdown格式**的消息。

- 功能1: 文本消息
- 功能2: Markdown消息
- 功能3: Webhook集成

时间: 2026-03-02 16:00""",
        "message_type": "markdown"
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return result.get("success", False)
    except Exception as e:
        print(f"失败: {e}")
        return False


def test_webhook():
    """测试Webhook接口"""
    print("\n测试3: Webhook接口")
    url = f"{BASE_URL}/webhook"
    headers = {"X-Webhook-Secret": WEBHOOK_SECRET}
    payload = {
        "message": "【Webhook测试】来自OpenClaw的消息",
        "channel": "telegram",
        "timestamp": 1709356800.0
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return result.get("success", False)
    except Exception as e:
        print(f"失败: {e}")
        return False


def test_health():
    """测试健康检查"""
    print("\n测试4: 健康检查")
    url = f"{BASE_URL}/health"

    try:
        response = requests.get(url, timeout=5)
        result = response.json()
        print(f"响应: {json.dumps(result, ensure_ascii=False, indent=2)}")
        return result.get("status") == "ok"
    except Exception as e:
        print(f"失败: {e}")
        return False


def main():
    """运行所有测试"""
    print("=" * 50)
    print("OpenClaw 企业微信桥接服务 - 测试脚本")
    print("=" * 50)

    # 检查服务是否运行
    print("\n检查服务状态...")
    if not test_health():
        print("❌ 服务未运行，请先启动: python main.py")
        return

    print("✅ 服务正常运行")

    # 运行测试
    results = {
        "文本消息": test_send_text(),
        "Markdown消息": test_send_markdown(),
        "Webhook": test_webhook()
    }

    # 汇总结果
    print("\n" + "=" * 50)
    print("测试结果汇总:")
    for name, success in results.items():
        status = "✅ 通过" if success else "❌ 失败"
        print(f"  {name}: {status}")
    print("=" * 50)


if __name__ == "__main__":
    main()