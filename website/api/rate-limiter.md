# Rate Limiter API

Utility for executing async operations with exponential back-off and retry when encountering transient rate-limiting (HTTP 429 / 503).

```typescript
import { withRetry } from '@el-j/google-sheet-translations';
```

---

## Functions

### `withRetry(fn, label, baseDelayMs?, retries?, maxDelayMs?)`

Calls an async function and automatically retries upon receiving rate-limit errors from Google APIs.

```typescript
function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  baseDelayMs?: number,
  retries?: number,
  maxDelayMs?: number
): Promise<T>
```

#### Parameters

- `fn` (`() => Promise<T>`): Async operation to execute.
- `label` (`string`): Log label for diagnostics.
- `baseDelayMs` (`number`): Initial back-off delay in ms. Default: `1000`.
- `retries` (`number`): Maximum number of retry attempts. Default: `3`.
- `maxDelayMs` (`number`): Maximum ceiling delay in ms. Default: `30000`.

#### Example

```typescript
const sheetData = await withRetry(
  () => fetchSheetData(sheetId),
  'fetchSheetData'
);
```
