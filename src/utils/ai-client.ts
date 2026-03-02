import { Context } from 'koishi'
import { Config } from '../index'   // 导入 Config 类型

export interface AIClient {
  analyze(content: string, prompt?: string): Promise<string>
}

export class DeepSeekClient implements AIClient {
  constructor(private ctx: Context, private apiKey: string, private model: string) {}

  async analyze(content: string, prompt: string = '请分析以下Minecraft服务器崩溃报告，指出可能的原因和解决方案：'): Promise<string> {
    try {
      const response = await this.ctx.http.post('https://api.deepseek.com/v1/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个Minecraft服务器崩溃分析专家。请用中文简洁明了地分析崩溃报告。' },
          { role: 'user', content: `${prompt}\n\n${content}` }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      return response.choices[0]?.message?.content || 'AI分析无返回结果'
    } catch (err) {
      throw new Error(`DeepSeek API调用失败: ${err.message}`)
    }
  }
}

export class OpenAIClient implements AIClient {
  constructor(private ctx: Context, private apiKey: string, private model: string) {}

  async analyze(content: string, prompt: string = '请分析以下Minecraft服务器崩溃报告，指出可能的原因和解决方案：'): Promise<string> {
    try {
      const response = await this.ctx.http.post('https://api.openai.com/v1/chat/completions', {
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个Minecraft服务器崩溃分析专家。请用中文简洁明了地分析崩溃报告。' },
          { role: 'user', content: `${prompt}\n\n${content}` }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      return response.choices[0]?.message?.content || 'AI分析无返回结果'
    } catch (err) {
      throw new Error(`OpenAI API调用失败: ${err.message}`)
    }
  }
}

export class CustomAIClient implements AIClient {
  constructor(
    private ctx: Context, 
    private apiKey: string, 
    private apiUrl: string,
    private model: string
  ) {}

  async analyze(content: string, prompt: string = '请分析以下Minecraft服务器崩溃报告，指出可能的原因和解决方案：'): Promise<string> {
    try {
      const response = await this.ctx.http.post(this.apiUrl, {
        model: this.model,
        messages: [
          { role: 'system', content: '你是一个Minecraft服务器崩溃分析专家。请用中文简洁明了地分析崩溃报告。' },
          { role: 'user', content: `${prompt}\n\n${content}` }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      })
      
      // 尝试多种可能的响应格式
      return response.choices?.[0]?.message?.content || 
             response.data?.choices?.[0]?.message?.content || 
             response.content || 
             'AI分析无返回结果'
    } catch (err) {
      throw new Error(`自定义API调用失败: ${err.message}`)
    }
  }
}

export interface CrashReportConfig {
  aiProvider: 'deepseek' | 'openai' | 'gemini' | 'custom'
  apiKey: string
  apiUrl?: string
  model?: string
  path: string
  maxLength: number
  enabled: boolean
}

export function createAIClient(
  ctx: Context, 
  config: CrashReportConfig
): AIClient {
  switch (config.aiProvider) {
    case 'deepseek':
      return new DeepSeekClient(ctx, config.apiKey, config.model || 'deepseek-chat')
    case 'openai':
      return new OpenAIClient(ctx, config.apiKey, config.model || 'gpt-3.5-turbo')
    case 'custom':
      if (!config.apiUrl) throw new Error('自定义AI服务需要配置apiUrl')
      return new CustomAIClient(ctx, config.apiKey, config.apiUrl, config.model || 'custom-model')
    default:
      throw new Error(`不支持的AI服务商: ${config.aiProvider}`)
  }
}