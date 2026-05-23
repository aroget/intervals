import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources";

export type Message = ChatCompletionMessageParam;

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface StructuredOptions extends ChatOptions {}

/**
 * A tool the agent can call. parametersJsonSchema must be a valid JSON Schema object.
 * Use zodToJsonSchema (or write manually) to produce from a Zod schema.
 */
export interface AgentTool<
  TParams = Record<string, unknown>,
  TResult = unknown,
> {
  name: string;
  description: string;
  /** Valid JSON Schema describing the parameters object */
  parametersJsonSchema: Record<string, unknown>;
  execute: (params: TParams) => Promise<TResult>;
}

export type OpenAITool = ChatCompletionTool;
