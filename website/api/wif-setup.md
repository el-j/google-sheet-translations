# WIF Setup API

Programmatic API for configuring Google Cloud Workload Identity Federation (WIF) and granting Google Drive permissions.

```typescript
import { setupWIF, grantDrivePermissions, GcpApiError } from '@el-j/google-sheet-translations';
```

---

## Functions

### `setupWIF(options)`

Provisions a Workload Identity Pool, OIDC Provider for GitHub Actions, and binds IAM permissions to the specified service account.

```typescript
function setupWIF(
  options: WifSetupOptions
): Promise<WifSetupResult>
```

#### Parameters

- `options` (`WifSetupOptions`):
  - `projectId` (`string`): Google Cloud Project ID.
  - `serviceAccountEmail` (`string`): Target service account email address.
  - `githubRepo` (`string`): GitHub repository in `owner/repo` format.
  - `poolId` (`string`): WIF pool identifier. Default: `'github-actions'`.
  - `providerId` (`string`): WIF provider identifier. Default: `'github-provider'`.
  - `driveFolderId` (`string`): Optional Drive folder ID to grant permissions on.

#### Returns

`Promise<WifSetupResult>`:
```typescript
interface WifSetupResult {
  projectNumber: string;
  poolId: string;
  providerId: string;
  poolResourceName: string;
  providerResourceName: string;
}
```

---

### `grantDrivePermissions(options)`

Grants a Google Cloud Service Account permissions to access a Google Drive folder.

```typescript
function grantDrivePermissions(
  options: GrantDrivePermissionsOptions
): Promise<void>
```
