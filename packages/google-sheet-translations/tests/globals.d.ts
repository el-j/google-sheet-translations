import type {
  Mock as VitestMock,
  MockedFunction as VitestMockedFunction,
  Mocked as VitestMocked,
  MockInstance as VitestMockInstance,
} from 'vitest';

declare global {
  type Mock<T extends (...args: any[]) => any = (...args: any[]) => any> = VitestMock<T>;
  type MockedFunction<T extends (...args: any[]) => any = (...args: any[]) => any> =
    VitestMockedFunction<T>;
  type Mocked<T = any> = VitestMocked<T>;
  type MockInstance = VitestMockInstance;
}
