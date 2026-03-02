let runtime = null;
export function setWeComRuntime(next) {
    runtime = next;
}
export function getWeComRuntime() {
    if (!runtime) {
        throw new Error("WeCom runtime not initialized");
    }
    return runtime;
}
