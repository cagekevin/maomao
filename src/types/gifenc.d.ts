/**
 * gifenc 模块声明（第三方包无自带 .d.ts，本地收口真实类型，禁用 any）。
 * 形状对齐 node_modules/gifenc/dist/gifenc.esm.js 导出（GIFEncoder / quantize / applyPalette）。
 */
declare module 'gifenc' {
  /** GIFEncoder() 返回的编码器实例 */
  export interface GIFEncoderInstance {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    readonly buffer: ArrayBuffer;
    readonly stream: unknown;
    writeHeader(): void;
    writeFrame(
      index: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      options?: {
        transparent?: boolean;
        transparentIndex?: number;
        delay?: number;
        palette?: number[][] | null;
        repeat?: number;
        colorDepth?: number;
        dispose?: number;
        first?: boolean;
      },
    ): void;
  }

  export interface GIFEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  export function GIFEncoder(options?: GIFEncoderOptions): GIFEncoderInstance;

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444';
      clearAlpha?: boolean;
      clearAlphaColor?: number;
      clearAlphaThreshold?: number;
      oneBitAlpha?: boolean | number;
      useSqrt?: boolean;
    },
  ): number[][];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: 'rgb565' | 'rgb444' | 'rgba4444',
  ): Uint8Array;

  export function nearestColor(color: number[], palette: number[][]): number[];
  export function nearestColorIndex(color: number[], palette: number[][]): number;
  export function nearestColorIndexWithDistance(
    color: number[],
    palette: number[][],
  ): [number, number];
  export function prequantize(
    rgba: Uint8Array | Uint8ClampedArray,
    options?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number },
  ): void;
  export function snapColorsToPalette(
    palette: number[][],
    colors: number[][],
    round?: number,
  ): void;

  const _default: (options?: GIFEncoderOptions) => GIFEncoderInstance;
  export default _default;
}
