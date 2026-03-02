import type { PluginRuntime } from "./types.js";

let runtime: PluginRuntime | null = null;

export function setWeComRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getWeComRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("WeCom runtime not initialized");
  }
  return runtime;
}