// 企业微信企业消息API
import axios from 'axios';

interface WeComMessage {
  msgtype: 'text' | 'markdown' | 'image' | 'file';
  text?: {
    content: string;
  };
  markdown?: {
    content: string;
  };
  image?: {
    media_id: string;
  };
  file?: {
    media_id: string;
  };
}

interface WeComSendResult {
  errcode: number;
  errmsg: string;
  msgid?: string;
  invaliduser?: string;
  invalidparty?: string;
}

export class WeComAPI {
  private corpid: string;
  private corpsecret: string;
  private agentid: string;
  private accessToken: string | null = null;
  private tokenExpireAt = 0;

  constructor(corpid: string, corpsecret: string, agentid: string) {
    this.corpid = corpid;
    this.corpsecret = corpsecret;
    this.agentid = agentid;
  }

  async getAccessToken(): Promise<string> {
    // 检查token是否过期
    if (this.accessToken && Date.now() < this.tokenExpireAt) {
      return this.accessToken;
    }

    const url = 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';
    const params = {
      corpid: this.corpid,
      corpsecret: this.corpsecret
    };

    const response = await axios.get(url, { params });
    const result = response.data as { errcode: number; errmsg: string; access_token: string; expires_in: number };

    if (result.errcode !== 0) {
      throw new Error(`获取access_token失败: ${result.errmsg}`);
    }

    this.accessToken = result.access_token;
    this.tokenExpireAt = Date.now() + (result.expires_in - 300) * 1000; // 提前5分钟过期

    return this.accessToken;
  }

  async sendTextMessage(content: string, touser?: string, toparty?: string): Promise<WeComSendResult> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const data: WeComMessage & { touser?: string; toparty?: string; agentid: string; msgtype: 'text' } = {
      msgtype: 'text',
      agentid: this.agentid,
      text: { content }
    };

    if (touser) data.touser = touser;
    if (toparty) data.toparty = toparty;

    const response = await axios.post(url, data);
    return response.data;
  }

  async sendMarkdownMessage(content: string, touser?: string, toparty?: string): Promise<WeComSendResult> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/message/send?access_token=${token}`;

    const data: WeComMessage & { touser?: string; toparty?: string; agentid: string; msgtype: 'markdown' } = {
      msgtype: 'markdown',
      agentid: this.agentid,
      markdown: { content }
    };

    if (touser) data.touser = touser;
    if (toparty) data.toparty = toparty;

    const response = await axios.post(url, data);
    return response.data;
  }

  async uploadMedia(filePath: string, mediaType: 'image' | 'file' | 'voice' | 'video' = 'image'): Promise<{ media_id: string; created_at: number }> {
    const token = await this.getAccessToken();
    const url = `https://qyapi.weixin.qq.com/cgi-bin/media/upload?access_token=${token}&type=${mediaType}`;

    const FormData = (await import('form-data')).default;
    const fs = (await import('fs')).default;

    const form = new FormData();
    form.append('media', fs.createReadStream(filePath));

    const response = await axios.post(url, form, {
      headers: form.getHeaders()
    });

    return response.data;
  }
}