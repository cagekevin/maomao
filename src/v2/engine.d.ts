// _engine 反编译产物的类型声明
declare module './_engine/App.js' {
  const App: React.ComponentType;
  export default App;
}

declare module './_engine/entry.js' {
  export function setActiveEndpoint(url: string): Promise<boolean>;
  export const endpoints: Array<{ label: string; url: string }>;
  export function getActiveEndpoint(): string;
  export function identity<T>(fn: () => T): () => T;
}

declare module './_engine/config.js' {
  export const ENDPOINTS: Array<{ label: string; url: string }>;
  export const DEFAULT_ENDPOINT: string;
  export function localEngineBase(): string;
  export const AUTH_TOKEN_KEY: string;
  export const USE_LOCAL_ENGINE: boolean;
  export const REMOTE_BASE: string;
  export const getLocalEngineBase: () => string;
}
