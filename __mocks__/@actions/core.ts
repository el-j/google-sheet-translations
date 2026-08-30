/**
 * Manual Vitest mock for @actions/core (v3, ESM-only).
 * Provides typed vi.fn() stubs for every symbol used in tests.
 */
import { vi } from 'vitest';

export const getInput = vi.fn((_name: string, _options?: { required?: boolean }) => '');
export const setOutput = vi.fn((_name: string, _value: unknown) => undefined);
export const setFailed = vi.fn((_message: string | Error) => undefined);
export const info = vi.fn((_message: string) => undefined);
export const warning = vi.fn((_message: string | Error) => undefined);
export const error = vi.fn((_message: string | Error) => undefined);
export const debug = vi.fn((_message: string) => undefined);
export const notice = vi.fn((_message: string | Error) => undefined);
export const startGroup = vi.fn((_name: string) => undefined);
export const endGroup = vi.fn(() => undefined);
export const addPath = vi.fn((_inputPath: string) => undefined);
export const exportVariable = vi.fn((_name: string, _val: unknown) => undefined);
export const getBooleanInput = vi.fn((_name: string) => false);
export const getMultilineInput = vi.fn((_name: string) => [] as string[]);
export const isDebug = vi.fn(() => false);
export const saveState = vi.fn((_name: string, _value: unknown) => undefined);
export const getState = vi.fn((_name: string) => '');
export const setSecret = vi.fn((_secret: string) => undefined);
export const summary = { addRaw: vi.fn(), write: vi.fn() };

export const InputOptions = {};

export enum ExitCode {
	Success = 0,
	Failure = 1,
}
