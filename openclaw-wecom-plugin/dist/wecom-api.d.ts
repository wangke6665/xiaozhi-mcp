interface WeComSendResult {
    errcode: number;
    errmsg: string;
    msgid?: string;
    invaliduser?: string;
    invalidparty?: string;
}
export declare class WeComAPI {
    private corpid;
    private corpsecret;
    private agentid;
    private accessToken;
    private tokenExpireAt;
    constructor(corpid: string, corpsecret: string, agentid: string);
    getAccessToken(): Promise<string>;
    sendTextMessage(content: string, touser?: string, toparty?: string): Promise<WeComSendResult>;
    sendMarkdownMessage(content: string, touser?: string, toparty?: string): Promise<WeComSendResult>;
    uploadMedia(filePath: string, mediaType?: 'image' | 'file' | 'voice' | 'video'): Promise<{
        media_id: string;
        created_at: number;
    }>;
}
export {};
