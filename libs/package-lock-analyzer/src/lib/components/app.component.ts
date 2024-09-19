import { Component, inject } from '@angular/core';
import { PackageSearchComponent } from './package-search.component';
import { MismatchTableComponent } from './mismatch-table.component';
import { VersionAnalysisService } from '../services/version-analysis.service';
import { Mismatches, PackageLock } from '../models/package-lock.model';
import { HttpClient } from '@angular/common/http';
import { take, tap } from 'rxjs';

@Component({
  standalone: true,
  selector: 'lib-app',
  imports: [
    PackageSearchComponent,
    MismatchTableComponent
  ],
  template: `
    <div>
      <lib-package-search (searchQuery)="handleSearchQuery($event)"></lib-package-search>
      <lib-mismatch-table [mismatches]="filteredMismatches"></lib-mismatch-table>
    </div>
  `
})

export class AppComponent {
  mismatches!: Mismatches;
  filteredMismatches!: Mismatches;

  constructor(private versionAnalysisService: VersionAnalysisService) {
    // Assuming you have the parsed package-lock.json data in `packageData`
    inject(HttpClient).get<PackageLock>('./package-lock.json').pipe(
      take(1),
      tap(
        (packageData: PackageLock) => {
          // const packageData: PackageLock = this.getMockPackageData();  // replace with actual data
          this.mismatches = this.versionAnalysisService.findVersionMismatches(packageData);
          this.filteredMismatches = { ...this.mismatches };

        }
      )
    )

      .subscribe();
  }

  handleSearchQuery(query: string): void {
    if (query) {
      this.filteredMismatches = Object.fromEntries(
        Object.entries(this.mismatches).filter(([key]) => key.toLowerCase().includes(query))
      );
    } else {
      this.filteredMismatches = { ...this.mismatches };
    }
  }

  private getMockPackageData(): PackageLock {
    // Mock or replace with actual data
    return {
      name: 'mock-package',
      version: '1.0.0',
      lockfileVersion: 1,
      packages: {
        'node_modules/package1': {
          version: '1.0.0'
        },
        'node_modules/package2': {
          version: '1.1.0'
        }
      }
    };
  }
}
