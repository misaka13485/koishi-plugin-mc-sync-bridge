import { Context } from 'koishi';
export interface AIClient {
    analyze(content: string, prompt?: string): Promise<string>;
}
export declare class DeepSeekClient implements AIClient {
    private ctx;
    private apiKey;
    private model;
    constructor(ctx: Context, apiKey: string, model: string);
    analyze(content: string, prompt?: string): Promise<string>;
}
export declare class OpenAIClient implements AIClient {
    private ctx;
    private apiKey;
    private model;
    constructor(ctx: Context, apiKey: string, model: string);
    analyze(content: string, prompt?: string): Promise<string>;
}
export declare class CustomAIClient implements AIClient {
    private ctx;
    private apiKey;
    private apiUrl;
    private model;
    constructor(ctx: Context, apiKey: string, apiUrl: string, model: string);
    analyze(content: string, prompt?: string): Promise<string>;
}
export interface CrashReportConfig {
    aiProvider: 'deepseek' | 'openai' | 'gemini' | 'custom';
    apiKey: string;
    apiUrl?: string;
    model?: string;
    path: string;
    maxLength: number;
    enabled: boolean;
}
export declare function createAIClient(ctx: Context, config: CrashReportConfig): AIClient;
