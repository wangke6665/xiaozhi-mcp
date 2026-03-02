import type { PluginRuntime, Channel } from "./types.js";
interface WeComConfig {
    corpid: string;
    corpsecret: string;
    agentid: string;
    token: string;
    encodingAESKey: string;
}
export declare function createWeComChannel(config: WeComConfig, runtime: PluginRuntime): Channel;
export {};
