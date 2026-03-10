/**
 * Manual Jest mock for @actions/core (v3, ESM-only).
 * Provides typed jest.fn() stubs for every symbol used in tests.
 */

export const getInput = jest.fn((_name: string, _options?: { required?: boolean }) => '');
export const setOutput = jest.fn((_name: string, _value: unknown) => undefined);
export const setFailed = jest.fn((_message: string | Error) => undefined);
export const info = jest.fn((_message: string) => undefined);
export const warning = jest.fn((_message: string | Error) => undefined);
export const error = jest.fn((_message: string | Error) => undefined);
export const debug = jest.fn((_message: string) => undefined);
export const notice = jest.fn((_message: string | Error) => undefined);
export const startGroup = jest.fn((_name: string) => undefined);
export const endGroup = jest.fn(() => undefined);
export const addPath = jest.fn((_inputPath: string) => undefined);
export const exportVariable = jest.fn((_name: string, _val: unknown) => undefined);
export const getBooleanInput = jest.fn((_name: string) => false);
export const getMultilineInput = jest.fn((_name: string) => [] as string[]);
export const isDebug = jest.fn(() => false);
export const saveState = jest.fn((_name: string, _value: unknown) => undefined);
export const getState = jest.fn((_name: string) => '');
export const setSecret = jest.fn((_secret: string) => undefined);
export const summary = { addRaw: jest.fn(), write: jest.fn() };

export const InputOptions = {};

export enum ExitCode {
	Success = 0,
	Failure = 1,
}
