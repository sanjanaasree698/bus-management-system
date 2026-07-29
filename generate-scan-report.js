// generate-scan-report.js
//
// Reads scan output files from scan-results/ (codeql-results, npm-audit-results,
// semgrep-results) and combines them into one Excel file:
//   Code Quality Reports/scan-data.xlsx
//
// Sheet 1: "All Findings" - one row per issue from any of the 3 tools
// Sheet 2: "Severity Summary" - count of rows per severity level
//
// HOW TO RUN (in VS Code terminal, inside your project folder):
//   npm install exceljs
//   node generate-scan-report.js

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const SCAN_DIR = path.join(__dirname, 'scan-results');
const OUTPUT_DIR = path.join(__dirname, 'Code Quality Reports');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'scan-data.xlsx');

function findFiles(dir, extList) {
  if (!fs.existsSync(dir)) return [];
  let results = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(findFiles(fullPath, extList));
    } else if (extList.some((ext) => item.name.toLowerCase().endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function safeReadJSON(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.warn(`Could not parse ${filePath}: ${e.message}`);
    return null;
  }
}

// --- Parse CodeQL SARIF files ---
function parseCodeQL(rows) {
  const dir = path.join(SCAN_DIR, 'codeql-results');
  const files = findFiles(dir, ['.sarif', '.json']);
  for (const file of files) {
    const data = safeReadJSON(file);
    if (!data || !data.runs) continue;
    for (const run of data.runs) {
      const rules = {};
      (run.tool?.driver?.rules || []).forEach((r) => {
        rules[r.id] = r;
      });
      for (const result of run.results || []) {
        const rule = rules[result.ruleId] || {};
        const level = result.level || rule.defaultConfiguration?.level || 'note';
        const loc = result.locations?.[0]?.physicalLocation?.artifactLocation?.uri || '';
        rows.push({
          source: 'CodeQL',
          category: result.ruleId || 'unknown',
          severity: mapSeverity(level),
          filePath: loc,
          description: (result.message?.text || '').slice(0, 300),
        });
      }
    }
  }
}

// --- Parse Semgrep JSON files ---
function parseSemgrep(rows) {
  const dir = path.join(SCAN_DIR, 'semgrep-results');
  const files = findFiles(dir, ['.json']);
  for (const file of files) {
    const data = safeReadJSON(file);
    if (!data || !data.results) continue;
    for (const result of data.results) {
      const severity = result.extra?.severity || result.extra?.metadata?.severity || 'INFO';
      rows.push({
        source: 'Semgrep',
        category: result.check_id || 'unknown',
        severity: mapSeverity(severity),
        filePath: result.path || '',
        description: (result.extra?.message || '').slice(0, 300),
      });
    }
  }
}

// --- Parse npm audit JSON files ---
function parseNpmAudit(rows) {
  const dir = path.join(SCAN_DIR, 'npm-audit-results');
  const files = findFiles(dir, ['.json']);
  for (const file of files) {
    const data = safeReadJSON(file);
    if (!data) continue;

    // npm audit v2 format (npm 7+)
    if (data.vulnerabilities) {
      for (const [pkgName, vuln] of Object.entries(data.vulnerabilities)) {
        rows.push({
          source: 'npm audit',
          category: pkgName,
          severity: mapSeverity(vuln.severity),
          filePath: (vuln.via || [])
            .map((v) => (typeof v === 'string' ? v : v.title))
            .join(', ')
            .slice(0, 200),
          description: `Range: ${vuln.range || 'n/a'}, FixAvailable: ${!!vuln.fixAvailable}`,
        });
      }
    }
    // npm audit legacy format
    if (data.advisories) {
      for (const [id, adv] of Object.entries(data.advisories)) {
        rows.push({
          source: 'npm audit',
          category: adv.module_name || id,
          severity: mapSeverity(adv.severity),
          filePath: adv.findings?.[0]?.paths?.[0] || '',
          description: (adv.overview || '').slice(0, 300),
        });
      }
    }
  }
}

function mapSeverity(level) {
  if (!level) return 'Info';
  const l = String(level).toLowerCase();
  if (['error', 'critical'].includes(l)) return 'Critical';
  if (['high'].includes(l)) return 'High';
  if (['warning', 'moderate', 'medium'].includes(l)) return 'Medium';
  if (['low', 'note'].includes(l)) return 'Low';
  return 'Info';
}

async function main() {
  const rows = [];

  parseCodeQL(rows);
  parseSemgrep(rows);
  parseNpmAudit(rows);

  console.log(`Total rows parsed: ${rows.length}`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const workbook = new ExcelJS.Workbook();

  // Sheet 1: All findings
  const sheet1 = workbook.addWorksheet('All Findings');
  sheet1.columns = [
    { header: 'Source Tool', key: 'source', width: 14 },
    { header: 'Category / Rule', key: 'category', width: 30 },
    { header: 'Severity', key: 'severity', width: 12 },
    { header: 'File Path', key: 'filePath', width: 45 },
    { header: 'Description', key: 'description', width: 60 },
  ];
  sheet1.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet1.addRow(r));

  // Sheet 2: Severity summary
  const sheet2 = workbook.addWorksheet('Severity Summary');
  const counts = {};
  rows.forEach((r) => {
    counts[r.severity] = (counts[r.severity] || 0) + 1;
  });
  sheet2.columns = [
    { header: 'Severity', key: 'severity', width: 15 },
    { header: 'Count', key: 'count', width: 10 },
  ];
  sheet2.getRow(1).font = { bold: true };
  Object.entries(counts).forEach(([severity, count]) => {
    sheet2.addRow({ severity, count });
  });
  sheet2.addRow({});
  sheet2.addRow({ severity: 'TOTAL', count: rows.length });

  await workbook.xlsx.writeFile(OUTPUT_FILE);
  console.log(`Excel report written to: ${OUTPUT_FILE}`);
}

main().catch((err) => {
  console.error('Error generating report:', err);
  process.exit(1);
});
