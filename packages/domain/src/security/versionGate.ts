/**
 * Version Control Gate for Offline Devices (Spec Section D).
 * 1. Checks device app_version and schema_version against server minimums.
 * 2. Blocks posting/syncing when outdated while keeping local read-only access.
 * 3. Notifies users when non-breaking updates are available.
 */

export interface SemanticVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly raw: string;
}

export function parseSemanticVersion(v: string): SemanticVersion {
  const clean = v.replace(/^v/i, '').trim();
  const parts = clean.split('.');
  const major = parseInt(parts[0] || '0', 10);
  const minor = parseInt(parts[1] || '0', 10);
  const patch = parseInt(parts[2] || '0', 10);

  return {
    major: isNaN(major) ? 0 : major,
    minor: isNaN(minor) ? 0 : minor,
    patch: isNaN(patch) ? 0 : patch,
    raw: v,
  };
}

/**
 * Returns:
 *  -1 if v1 < v2
 *   0 if v1 === v2
 *   1 if v1 > v2
 */
export function compareVersions(v1Str: string, v2Str: string): number {
  const v1 = parseSemanticVersion(v1Str);
  const v2 = parseSemanticVersion(v2Str);

  if (v1.major !== v2.major) return v1.major > v2.major ? 1 : -1;
  if (v1.minor !== v2.minor) return v1.minor > v2.minor ? 1 : -1;
  if (v1.patch !== v2.patch) return v1.patch > v2.patch ? 1 : -1;
  return 0;
}

export type VersionGateStatus = 'UP_TO_DATE' | 'UPDATE_AVAILABLE' | 'BLOCKED_OUTDATED';

export interface ServerVersionPolicy {
  readonly minSupportedAppVersion: string; // e.g. "1.0.0"
  readonly minSupportedSchemaVersion: number; // e.g. 1
  readonly latestAppVersion: string; // e.g. "1.1.0"
  readonly releaseNotes?: string;
}

export interface VersionGateEvaluation {
  readonly status: VersionGateStatus;
  readonly isPostingAllowed: boolean;
  readonly isSyncAllowed: boolean;
  readonly isReadAllowed: boolean;
  readonly userMessage: string;
  readonly releaseNotes?: string;
  readonly clientAppVersion: string;
  readonly clientSchemaVersion: number;
}

export function evaluateVersionGate(params: {
  readonly clientAppVersion: string;
  readonly clientSchemaVersion: number;
  readonly serverPolicy: ServerVersionPolicy;
}): VersionGateEvaluation {
  const { clientAppVersion, clientSchemaVersion, serverPolicy } = params;

  const isAppOutdated = compareVersions(clientAppVersion, serverPolicy.minSupportedAppVersion) < 0;
  const isSchemaOutdated = clientSchemaVersion < serverPolicy.minSupportedSchemaVersion;

  if (isAppOutdated || isSchemaOutdated) {
    return {
      status: 'BLOCKED_OUTDATED',
      isPostingAllowed: false,
      isSyncAllowed: false,
      isReadAllowed: true, // Local offline read access is strictly preserved (Spec Section D)
      userMessage: 'This app needs an update. Connect to the internet and tap Update',
      releaseNotes: serverPolicy.releaseNotes,
      clientAppVersion,
      clientSchemaVersion,
    };
  }

  const isUpdateAvailable = compareVersions(clientAppVersion, serverPolicy.latestAppVersion) < 0;

  if (isUpdateAvailable) {
    return {
      status: 'UPDATE_AVAILABLE',
      isPostingAllowed: true,
      isSyncAllowed: true,
      isReadAllowed: true,
      userMessage: `Update available (${serverPolicy.latestAppVersion}). Features improvements and fixes.`,
      releaseNotes: serverPolicy.releaseNotes,
      clientAppVersion,
      clientSchemaVersion,
    };
  }

  return {
    status: 'UP_TO_DATE',
    isPostingAllowed: true,
    isSyncAllowed: true,
    isReadAllowed: true,
    userMessage: `App is up to date (${clientAppVersion}).`,
    clientAppVersion,
    clientSchemaVersion,
  };
}
