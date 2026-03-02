# OpenClaw 企业微信桥接服务

将OpenClaw的消息转发到企业微信的通知服务。

## 功能特性

- ✅ 支持文本消息和Markdown格式消息
- ✅ 支持应用消息和群机器人两种发送方式
- ✅ 支持指定接收用户/部门
- ✅ 提供Webhook接口供OpenClaw调用
- ✅ 健康检查接口

## 快速开始

### 1. 安装依赖

```bash
cd wecom-bridge
pip install -r requirements.txt
```

### 2. 配置企业微信

编辑 `config.yaml`：

```yaml
wecom:
  corpid: "你的企业ID"
  agent:
    secret: "你的应用Secret"
    agentid: 1000001
  to_user: "zhangsan|lisi"  # 接收人ID
  to_party: "1|2"  # 接收部门ID
  webhook:
    enabled: false
    key: ""

server:
  host: "0.0.0.0"
  port: 8900
```

**获取企业ID和应用Secret：**
1. 登录企业微信管理后台
2. 进入「应用管理」→「应用」→「自建应用」
3. 查看企业ID（CorpID）
4. 点击应用，查看Secret和AgentId

### 3. 启动服务

```bash
python main.py
```

服务将在 `http://0.0.0.0:8900` 启动

## API 接口

### POST /send
手动发送消息

**请求体：**
```json
{
  "message": "测试消息",
  "message_type": "text",
  "to_user": "zhangsan",
  "to_party": "",
  "use_webhook": false
}
```

### POST /webhook
OpenClaw Webhook接收端

**请求头：**
```
X-Webhook-Secret: webhook_secret_key
```

**请求体：**
```json
{
  "message": "来自OpenClaw的消息",
  "channel": "telegram",
  "timestamp": 1709356800.0
}
```

### GET /health
健康检查

## 使用方式

### 方式1：HTTP API调用

```bash
curl -X POST http://localhost:8900/send \
  -H "Content-Type: application/json" \
  -d '{
    "message": "这是一条测试消息",
    "message_type": "text"
  }'
```

### 方式2：集成到OpenClaw

在OpenClaw的代码中添加企业微信通知：

```python
import requests

# 发送消息到企业微信
def notify_wecom(message):
    url = "http://localhost:8900/webhook"
    headers = {"X-Webhook-Secret": "your_secret"}
    payload = {"message": message}
    requests.post(url, json=payload, headers=headers)

# 使用
notify_wecom("API调用成功！")
```

### 方式3：命令行测试

```bash
python test.py
```

## 常见问题

### 获取用户ID
1. 企业微信管理后台 →「通讯录」
2. 点击成员，查看成员详情
3. 在「账号」栏可以看到成员的UserID

### 获取部门ID
1. 企业微信管理后台 →「通讯录」→「组织架构」
2. 点击部门，查看部门信息
3. 部门ID就是部门的数字ID

### 消息发送失败
- 检查企业ID、Secret、AgentId是否正确
- 确认应用已启用且已分配到接收人
- 查看日志获取详细错误信息

## 配置说明

| 配置项 | 说明 |
|--------|------|
| corpid | 企业ID |
| secret | 应用Secret |
| agentid | 应用ID |
| to_user | 接收人，多个用\|分隔 |
| to_party | 接收部门ID，多个用\|分隔 |
| webhook.enabled | 是否使用群机器人 |
| webhook.key | 群机器人的key |

## License

MIT