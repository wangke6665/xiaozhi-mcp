# OpenClaw 企业微信插件

为OpenClaw添加企业微信通道支持。

## 功能特性

- ✅ 发送文本消息
- ✅ 发送Markdown格式消息
- ✅ 支持指定接收人/部门
- ✅ 健康检查
- 🔄 接收消息（开发中）

## 安装

### 1. 安装依赖

```bash
cd /root/.openclaw/workspace/openclaw-wecom-plugin
npm install
```

### 2. 编译

```bash
npm run build
```

### 3. 复制到OpenClaw扩展目录

```bash
mkdir -p /root/.openclaw/extensions/wecom
cp -r . /root/.openclaw/extensions/wecom/
```

或者使用符号链接：

```bash
ln -s /root/.openclaw/workspace/openclaw-wecom-plugin /root/.openclaw/extensions/wecom
```

## 配置

在OpenClaw配置文件中添加企业微信通道配置：

```yaml
channels:
  wecom:
    enabled: true
    corpid: "你的企业ID"
    corpsecret: "你的应用Secret"
    agentid: "你的应用ID"
    token: "你的Token"
    encodingAESKey: "你的EncodingAESKey"
```

## 获取企业微信配置

### 1. 企业ID (CorpID)

- 登录企业微信管理后台
- 我的企业 → 企业信息
- 复制企业ID

### 2. 应用Secret

- 应用管理 → 应用 → 你的应用
- Secret → 查看 → 发送
- 在企业微信中复制Secret

### 3. 应用ID (AgentID)

- 应用管理 → 应用 → 你的应用
- 在应用详情页查看AgentId

### 4. Token 和 EncodingAESKey

- 应用管理 → 应用 → 你的应用
- 功能 → 接收消息 → 设置API接收
- 随机获取Token和EncodingAESKey

## 使用

### 发送消息

```typescript
import { getWeComRuntime } from "openclaw-wecom-plugin";

const runtime = getWeComRuntime();
const channel = runtime.getChannel('wecom');

await channel.sendMessage({
  text: "这是一条测试消息",
  userId: "@all" // 发送给所有人
});
```

### 发送Markdown

```typescript
await channel.sendMarkdown("# 标题\n这是**粗体**文本", {
  userId: "@all"
});
```

### 通过OpenClaw CLI

```bash
openclaw channels add \
  --channel wecom \
  --corpid "ww123456" \
  --corpsecret "xxx" \
  --agentid "1000001" \
  --token "yyy" \
  --encoding-aes-key "zzz"
```

## API

### createWeComChannel(config, runtime)

创建企业微信通道实例。

**参数:**
- `config`: WeComConfig
  - `corpid`: 企业ID
  - `corpsecret`: 应用Secret
  - `agentid`: 应用ID
  - `token`: Token
  - `encodingAESKey`: EncodingAESKey
- `runtime`: PluginRuntime

**返回:** Channel

### WeComAPI

企业微信API客户端类。

**方法:**
- `getAccessToken()`: 获取访问令牌
- `sendTextMessage(content, touser?, toparty?)`: 发送文本消息
- `sendMarkdownMessage(content, touser?, toparty?)`: 发送Markdown消息
- `uploadMedia(filePath, mediaType)`: 上传媒体文件

## 开发

### 构建项目

```bash
npm run build
```

### 监听模式

```bash
npm run watch
```

### 测试

```bash
npm test
```

## 依赖

- openclaw/plugin-sdk: OpenClaw插件SDK
- axios: HTTP客户端

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！

## 相关链接

- [OpenClaw文档](https://docs.openclaw.ai)
- [企业微信API文档](https://developer.work.weixin.qq.com/document/path/90665)