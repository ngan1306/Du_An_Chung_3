// SQL Server layer (Windows Authentication) - dung msnodesqlv8 qua ODBC
// Luu y: dung port tinh 'localhost,1433' thay vi instance name '\SQLEXPRESS'
const odbc = require('msnodesqlv8');
const { DB_CONFIG } = require('./config');

const CONN = `Server=${DB_CONFIG.server};Database=${DB_CONFIG.database};Trusted_Connection=Yes;Driver=${DB_CONFIG.driver};`;

// hang doi ket noi: moi query mo 1 connection moi va dong ngay -> tranh treo
function odbcQuery(sqlText, params) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Query timeout: ' + sqlText.slice(0, 80))), 15000);
    odbc.query(CONN, sqlText, params || [], (err, result) => {
      clearTimeout(timeout);
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function flattenResult(r) {
  if (Array.isArray(r) && r.length && Array.isArray(r[0])) return r[r.length - 1] || [];
  return r || [];
}

function camelize(r) {
  const out = {};
  for (const k of Object.keys(r)) out[k === 'is_read' ? 'read' : k] = r[k];
  return out;
}

function norm(args) {
  return args.length === 1 && Array.isArray(args[0]) ? args[0].map(v => v ?? null) : args.map(v => v ?? null);
}

async function query(sqlText, ...args) {
  const rows = await odbcQuery(sqlText, norm(args));
  return flattenResult(rows).map(camelize);
}

// exec: INSERT -> {insertId}; khac -> {changes}
async function exec(sqlText, ...args) {
  const p = norm(args);
  if (/^\s*INSERT/i.test(sqlText)) {
    const valuesPos = sqlText.toUpperCase().indexOf('VALUES');
    if (valuesPos > 0) {
      const noIdentity = /INTO\s+(favorites|follows|comment_likes|post_likes|collection_items)\b/i.test(sqlText);
      const idCol = /INTO\s+ratings\b/i.test(sqlText) ? 'rowid' : 'id';
      if (!noIdentity) {
        const outSql = sqlText.slice(0, valuesPos) + `OUTPUT INSERTED.${idCol} AS lastId ` + sqlText.slice(valuesPos);
        const rows = await odbcQuery(outSql, p);
        const flat = flattenResult(rows);
        return { insertId: Number((flat[0] || {}).lastId || 0), changes: 1 };
      }
    }
  }
  await odbcQuery(sqlText, p);
  return { insertId: 0, changes: 1 };
}

async function get(sqlText, ...args) { const r = await query(sqlText, ...args); return r[0] || null; }

module.exports = { query, exec, get, CONN };
