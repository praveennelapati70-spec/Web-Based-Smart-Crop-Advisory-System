const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

async function resetPassword() {
    const email = 'praveennelapati70@gmail.com';
    const newPassword = '12345';

    try {
        console.log(`Resetting password for ${email}...`);
        const [result] = await promisePool.query(
            "UPDATE users SET password = ? WHERE email = ?",
            [newPassword, email]
        );

        if (result.affectedRows > 0) {
            console.log("SUCCESS: Password updated.");
            // Also fetch the username to be sure
            const [rows] = await promisePool.query("SELECT username FROM users WHERE email = ?", [email]);
            console.log("USERNAME IS:", rows[0].username);
        } else {
            console.log("ERROR: User not found with that email.");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

resetPassword();
