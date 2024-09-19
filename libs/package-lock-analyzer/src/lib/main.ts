import * as fs from 'fs';
import * as path from 'path';
import * as open from 'open';
import { VersionAnalysisService } from './services/version-analysis.service';

// Import the version analysis logic from the library

function findPackageLock(): string {
  const currentDir = process.cwd();
  const packageLockPath = path.join(currentDir, 'package-lock.json');

  if (!fs.existsSync(packageLockPath)) {
    console.error('Error: package-lock.json not found in the current directory.');
    process.exit(1);
  }

  return packageLockPath;
}

function generateHTML(mismatches: Record<string, any>): string {
  let html = `
    <html>
    <head>
      <style>
        .red { color: red; }
        .orange { color: orange; }
        .green { color: green; }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        table, th, td {
          border: 1px solid #dededf;
        }
        th, td {
          padding: 10px;
          text-align: left;
        }
        th {
          background-color: #f2f2f2;
        }
      </style>
    </head>
    <body>
      <h1>Version Mismatches</h1>
      <table>
        <thead>
          <tr>
            <th>Package Name</th>
            <th>Version</th>
            <th>Requesters</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const [packageName, versions] of Object.entries(mismatches)) {
    for (const [version, requesters] of Object.entries<any>(versions)) {
      const colorClass = Object.keys(versions).length > 1 ? 'red' : 'green';
      html += `
        <tr class="${colorClass}">
          <td>${packageName}</td>
          <td>${version}</td>
          <td>${requesters.join(', ')}</td>
        </tr>
      `;
    }
  }

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  const outputPath = path.join(process.cwd(), 'version-mismatches.html');
  fs.writeFileSync(outputPath, html);
  return outputPath;
}

function viewVersionMismatches(): void {
  const packageLockPath = findPackageLock();
  const packageLockData = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

  const versionAnalysisService = new VersionAnalysisService();
  const mismatches = versionAnalysisService.findVersionMismatches(packageLockData);

  const htmlFilePath = generateHTML(mismatches);
  open(htmlFilePath);
}

viewVersionMismatches();
