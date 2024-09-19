export interface PackageInfo {
  version?: string;
}

export interface VersionMap {
  [packageName: string]: {
    [version: string]: string[];
  };
}

export interface Mismatches {
  [packageName: string]: {
    [version: string]: string[];
  };
}
export interface Package {
  version: string;
  resolved?: string;
  integrity?: string;
  dev?: boolean;
  requires?: { [dependencyName: string]: string };
  dependencies?: { [dependencyName: string]: Package };
}

export interface PackageLock {
  name: string;
  version: string;
  lockfileVersion: number;
  packages: { [path: string]: Package };
}
