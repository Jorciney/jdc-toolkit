#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const open = require('open');

// Import the version analysis logic from the library
// const { VersionAnalysisService } = require('../dist/version-mismatch-analyzer/bundles/version-mismatch-analyzer.umd.js');
const { VersionAnalysisService } = require('../dist/package-lock-analyzer/esm2022/lib/services/version-analysis.service.mjs');

function findPackageLock() {
  const currentDir = process.cwd();
  const packageLockPath = path.join(currentDir, 'package-lock.json');

  if (!fs.existsSync(packageLockPath)) {
    console.error('Error: package-lock.json not found in the current directory.');
    process.exit(1);
  }

  return packageLockPath;
}

function generateHTML(mismatches) {
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
    for (const [version, requesters] of Object.entries(versions)) {
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

function viewVersionMismatches() {
  const packageLockPath = findPackageLock();
  const packageLockData = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));

  const versionAnalysisService = new VersionAnalysisService();
  const mismatches = versionAnalysisService.findVersionMismatches(packageLockData);

  const htmlFilePath = generateHTML(mismatches);
  open(htmlFilePath);
}

viewVersionMismatches();
