import { Injectable } from '@angular/core';
import { Mismatches, PackageLock, VersionMap } from '../models/package-lock.model';

@Injectable({
  providedIn: 'root'
})
export class VersionAnalysisService {

  findVersionMismatches(data: PackageLock): Mismatches {
    const packages = data.packages;
    const versionMap: VersionMap = {};

    for (const [key, value] of Object.entries(packages)) {
      if (value.version) {
        const packageName = key.split('node_modules/').pop() as string;
        if (!versionMap[packageName]) {
          versionMap[packageName] = {};
        }
        if (!versionMap[packageName][value.version]) {
          versionMap[packageName][value.version] = [];
        }
        versionMap[packageName][value.version].push(key);
      }
    }

    const mismatches: Mismatches = {};
    for (const [packageName, versions] of Object.entries(versionMap)) {
      if (Object.keys(versions).length > 1) {
        mismatches[packageName] = versions;
      }
    }

    return mismatches;
  }
}
