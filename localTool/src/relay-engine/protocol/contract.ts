/**
 * protocol/contract — 协议执行的输入 / 输出契约。
 *
 * 描述「调用一个协议需要给什么、会拿回什么」的全部类型，是 executor 与上层
 * 生成入口之间唯一的接口面。改这里等于改对外 API。
 */
import type {
  ModelExecutionProtocol,
  NormalizedModelExecutionProtocol,
  ProtocolJsonValue,
  ResolvedModelProtocolPoll,
} from '../types/protocol';

export type ModelProtocolVariables = Record<string, ProtocolJsonValue | undefined>;

export interface SubmitModelProtocolOptions {
  apiKey: string;
  baseUrl: string;
  protocol: ModelExecutionProtocol;
  variables: ModelProtocolVariables;
  signal?: AbortSignal;
}

export interface SubmittedModelProtocol {
  urls?: string[];
  text?: string;
  poll?: ResolvedModelProtocolPoll;
  taskId?: string;
}

export interface ExecuteModelProtocolOptions extends SubmitModelProtocolOptions {
  signal?: AbortSignal;
}

export type BuildModelProtocolRequestOptions = SubmitModelProtocolOptions & {
  signal?: AbortSignal;
};

export interface ExecuteModelProtocolResult {
  urls?: string[];
  text?: string;
  taskId?: string;
}

export interface BuiltModelProtocolRequest {
  url: string;
  init: RequestInit;
  protocol: NormalizedModelExecutionProtocol;
  renderedBody?: ProtocolJsonValue;
}

export interface ModelProtocolRequestPreview {
  method: string;
  relativeUrl: string;
  headers: Record<string, string>;
  body?: ProtocolJsonValue;
}

export type { ModelProtocolResponsePreviewEntry } from './response';
