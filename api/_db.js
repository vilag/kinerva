const mysql = require('mysql2/promise');

function getConnection() {
  return mysql.createConnection({
    host:        process.env.DB_HOST,
    user:        process.env.DB_USER,
    password:    process.env.DB_PASS,
    database:    process.env.DB_NAME,
    ssl:         { rejectUnauthorized: false },
    dateStrings: true,   // MySQL dates → strings (no timezone drift)
  });
}

module.exports = { getConnection };
