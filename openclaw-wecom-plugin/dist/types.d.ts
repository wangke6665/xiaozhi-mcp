export interface PluginRuntime {
    logger: Logger;
    registerChannel(channel: Channel): void;
    getChannel(id: string): Channel | undefined;
}
export interface Logger {
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
}
export interface Channel {
    id: string;
    name: string;
    type: string;
    start?(): Promise<void>;
    stop?(): Promise<void>;
    sendMessage(message: MessagePayload): Promise<string>;
    sendMarkdown?(markdown: string, options?: {
        userId?: string;
    }): Promise<string>;
    healthCheck?(): Promise<boolean>;
}
export interface MessagePayload {
    text: string;
    userId?: string;
    username?: string;
    channelId?: string;
    replyToMessageId?: string;
}
export interface PluginInitFn {
    (runtime: PluginRuntime, config: any): Promise<Channel>;
}
declare global {
    namespace NodeJS {
        interface Global {
            openclaw?: {
                plugins?: {
                    wecom?: {
                        init: PluginInitFn;
                    };
                };
            };
        }
    }
}
