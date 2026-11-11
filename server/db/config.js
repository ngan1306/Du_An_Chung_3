// Cau hinh SQL Server - sua theo may cua ban
// Mac dinh dung SQL Server instance SQLEXPRESS tren may local.
module.exports = {
  DB_CONFIG: {
    // Co the ghi de bang MSSQL_SERVER neu can dung may/instance khac.
    server: process.env.MSSQL_SERVER || ".\\SQLEXPRESS",
    database: process.env.MSSQL_DB || "RecipeAppDB",
    // Windows Authentication (dung user Windows hien tai, nhu trong SSMS)
    // Neu muon dung SQL login: them UID/PWD va bo Trusted_Connection trong mssql.js
    driver: process.env.MSSQL_DRIVER || "{ODBC Driver 17 for SQL Server}",
  },
};
