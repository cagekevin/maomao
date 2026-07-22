/// <reference types="vite/client" />
/// <reference types="chrome" />

declare module '*.svg' {
  const content: string;
  export default content;
}

declare module '*.png' {
  const content: string;
  export default content;
}

declare module '*/App.js' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const App: any;
  export default App;
}