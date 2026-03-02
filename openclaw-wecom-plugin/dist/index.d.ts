export { createWeComChannel } from "./channel.js";
export { WeComAPI } from "./wecom-api.js";
export { setWeComRuntime, getWeComRuntime } from "./runtime.js";
import type { PluginRuntime } from "./types.js";
export declare function initPlugin(runtime: PluginRuntime, config: any): Promise<import("./types.js").Channel>;
