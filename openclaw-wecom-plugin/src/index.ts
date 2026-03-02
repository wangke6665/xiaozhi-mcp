export { createWeComChannel } from "./channel.js";
export { WeComAPI } from "./wecom-api.js";
export { setWeComRuntime, getWeComRuntime } from "./runtime.js";

import type { PluginRuntime } from "./types.js";
import { createWeComChannel } from "./channel.js";

export async function initPlugin(runtime: PluginRuntime, config: any) {
  runtime.logger.info('初始化企业微信插件');

  if (!config.corpid || !config.corpsecret || !config.agentid) {
    throw new Error('缺少必要的企业微信配置: corpid, corpsecret, agentid');
  }

  const channel = createWeComChannel(config, runtime);
  runtime.registerChannel(channel);

  return channel;
}