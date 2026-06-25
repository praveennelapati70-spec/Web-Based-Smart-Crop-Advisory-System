const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function initDB() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME, // Connect to DB if exists, schema handles creation safely
            multipleStatements: true
        });
        const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await connection.query(schema);
        console.log('Database schema applied: `advisory_logs` and `feedback` tables ready.');
    } catch (err) {
        console.error('Error applying schema:', err);
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit(0);
    }
}

initDB();
