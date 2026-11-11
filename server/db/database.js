// SQL Server version - giup giu API cu: db.prepare(...).get/all/run -> async
// Uu nghi dung query/exec/get truc tiep trong cac route (da chuyen sang async)
const { query, exec, get } = require('./mssql');

// Helper giong sqlite api nhung bat dong bo
const db = {
  prepare: (sql) => ({
    get: async (...p) => (await query(sql, p))[0] || null,
    all: async (...p) => await query(sql, p),
    run: async (...p) => { const r = await exec(sql, p); return r; }
  }),
  query, exec, get
};

module.exports = { db, query, exec, get };
