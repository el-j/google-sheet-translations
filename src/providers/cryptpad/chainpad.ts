// @ts-ignore
import rawChainPad from '../../../vendor/chainpad.cjs';

export interface ChainPadInstance {
  start(): void;
  message(msg: string): void;
  getUserDoc(): string;
}

export interface ChainPadStatic {
  create(options: { patchTransformer: unknown; logLevel?: number }): ChainPadInstance;
  SmartJSONTransformer: unknown;
}

export const ChainPad: ChainPadStatic =
  rawChainPad && typeof rawChainPad.create === 'function'
    ? rawChainPad
    : (rawChainPad?.default ?? rawChainPad);
