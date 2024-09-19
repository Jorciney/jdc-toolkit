import { Component, input } from '@angular/core';
import { NgClass, NgForOf } from '@angular/common';
import { Mismatches } from '../models/package-lock.model';

@Component({
  standalone: true,
  selector: 'lib-mismatch-table',
  template: `
    <table>
      <thead>
      <tr>
        <th>Package Name</th>
        <th>Version</th>
        <th>Requesters</th>
      </tr>
      </thead>
      <tbody>
        @for (packageName of Object.keys(mismatches()); track packageName; ) {
          <tr>
            @for (version of Object.keys(mismatches()[packageName]); track version; ) {
              <ng-container>
                <td [ngClass]="getColorClass(mismatches()[packageName])">{{ mismatches()[packageName] }}</td>
                <td>{{ version }}</td>
                <td>{{ mismatches()[packageName][version].join(', ') }}</td>
              </ng-container>
            }
          </tr>
        }
      </tbody>
    </table>

  `,
  imports: [
    NgForOf,
    NgClass
  ],
  styles: [
    `
      .red {
        color: red;
      }

      .orange {
        color: orange;
      }

      .green {
        color: green;
      }
    `
  ]
})

export class MismatchTableComponent {
  mismatches = input.required<Mismatches>();
  Object = Object;

  getColorClass(versions: { [version: string]: string[] }): string {
    const majorVersions = new Set(Object.keys(versions).map(version => version.split('.')[0]));
    const minorVersions = new Set(Object.keys(versions).map(version => version.split('.')[1]));
    const patchVersions = new Set(Object.keys(versions).map(version => version.split('.')[2]));

    if (majorVersions.size > 1) {
      return 'red';
    } else if (minorVersions.size > 1) {
      return 'orange';
    } else if (patchVersions.size > 1) {
      return 'green';
    }
    return '';
  }

}
