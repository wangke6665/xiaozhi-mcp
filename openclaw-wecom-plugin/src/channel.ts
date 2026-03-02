// OpenClaw WeCom Channel
import type { PluginRuntime, Channel } from "./types.js";
import { WeComAPI } from "./wecom-api.js";

interface WeComConfig {
  corpid: string;
  corpsecret: string;
  agentid: string;
  token: string;
  encodingAESKey: string;
}

interface MessagePayload {
  text: string;
  userId?: string;
  username?: string;
  channelId?: string;
  replyToMessageId?: string;
}

interface ChannelMessage {
  id: string;
  text: string;
  from: {
    id: string;
    name?: string;
  };
  channel: {
    id: string;
    name?: string;
  };
  timestamp: number;
  replyTo?: string;
}

export function createWeComChannel(config: WeComConfig, runtime: PluginRuntime): Channel {
  const api = new WeComAPI(config.corpid, config.corpsecret, config.agentid);
  const logger = runtime.logger;

  logger.info(`WeCom通道初始化: 企业ID=${config.corpid}, 应用ID=${config.agentid}`);

  return {
    id: 'wecom',
    name: '企业微信',
    type: 'wecom',

    async start() {
      logger.info('WeCom通道启动');
      // 这里可以启动webhook监听企业微信的推送
    },

    async stop() {
      logger.info('WeCom通道停止');
    },

    async sendMessage(message: MessagePayload): Promise<string> {
      try {
        logger.info(`发送消息到企业微信: ${message.text.substring(0, 50)}...`);

        // 发送文本消息
        const result = await api.sendTextMessage(
          message.text,
          message.userId || '@all', // 默认发给所有人
          undefined
        );

        if (result.errcode !== 0) {
          throw new Error(`发送消息失败: ${result.errmsg}`);
        }

        const messageId = result.msgid || `wecom_${Date.now()}`;
        logger.info(`消息发送成功: ${messageId}`);
        return messageId;
      } catch (error) {
        logger.error(`发送消息失败: ${error}`);
        throw error;
      }
    },

    async sendMarkdown(markdown: string, options?: { userId?: string }): Promise<string> {
      try {
        logger.info(`发送Markdown消息到企业微信: ${markdown.substring(0, 50)}...`);

        const result = await api.sendMarkdownMessage(
          markdown,
          options?.userId || '@all'
        );

        if (result.errcode !== 0) {
          throw new Error(`发送Markdown失败: ${result.errmsg}`);
        }

        const messageId = result.msgid || `wecom_md_${Date.now()}`;
        logger.info(`Markdown消息发送成功: ${messageId}`);
        return messageId;
      } catch (error) {
        logger.error(`发送Markdown失败: ${error}`);
        throw error;
      }
    },

    async healthCheck(): Promise<boolean> {
      try {
        const token = await api.getAccessToken();
        return !!token;
      } catch {
        return false;
      }
    }
  };
}