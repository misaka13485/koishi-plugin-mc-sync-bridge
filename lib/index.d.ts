import { Context, Schema } from 'koishi';
declare module 'koishi' {
    interface Events {
        'mc-bridge/mc-message'(msg: any): void;
    }
}
export declare const name = "mc-sync-bridge";
export declare const inject: string[];
export interface QQToMcFilter {
    enable: boolean;
    prefixes?: string[];
}
export interface McToQqFilter {
    enable: boolean;
    chat?: boolean;
    join?: boolean;
    leave?: boolean;
    death?: boolean;
    achievement?: boolean;
    prefixes?: string[];
}
export interface Config {
    id: string;
    name: string;
    wsUrl: string;
    selfName: string;
    wsToken?: string;
    groups: string[];
    filters: {
        qqToMc: QQToMcFilter;
        mcToQq: McToQqFilter;
    };
    admins: string[];
    reconnectInterval: number;
    debug: boolean;
    motd?: {
        enabled: boolean;
        host: string;
        port: number;
    };
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
