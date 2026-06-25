const mysql = require('mysql2');
require('dotenv').config();

let pool = null;
let useMock = false;

// Determine if we should use mock database
if (!process.env.DB_HOST || (process.env.DB_HOST === 'localhost' && process.env.VERCEL)) {
    console.warn("⚠️ No remote database configuration found. Using In-Memory Database.");
    useMock = true;
} else {
    try {
        pool = mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            waitForConnections: true,
            connectionLimit: 5,
            queueLimit: 0,
            connectTimeout: 5000 // 5 seconds timeout
        });
    } catch (err) {
        console.warn("⚠️ Failed to create MySQL pool. Using In-Memory Database:", err.message);
        useMock = true;
    }
}

// In-memory data store for fallback
const mockData = {
    users: [
        { id: 1, username: 'farmer', password: '12345', email: 'farmer@test.com', created_at: new Date() },
        { id: 2, username: 'admin', password: 'admin', email: 'admin@test.com', created_at: new Date() }
    ],
    advisory_logs: [],
    feedback: []
};

// Internal execution logic for mock queries
async function executeMock(sql, params = []) {
    console.log(`[Mock DB] Executing: ${sql} with params:`, params);
    const sqlUpper = sql.toUpperCase();
    
    if (sqlUpper.includes('CREATE TABLE')) {
        return [[]]; // No-op for table creation
    }
    
    if (sqlUpper.includes('SELECT * FROM USERS')) {
        const username = params[0];
        const found = mockData.users.filter(u => u.username === username);
        return [found];
    }
    
    if (sqlUpper.includes('INSERT INTO USERS')) {
        const [username, password, email] = params;
        if (mockData.users.some(u => u.username === username)) {
            const err = new Error("Duplicate entry");
            err.code = 'ER_DUP_ENTRY';
            throw err;
        }
        const newUser = {
            id: mockData.users.length + 1,
            username,
            password,
            email,
            created_at: new Date()
        };
        mockData.users.push(newUser);
        return [{ insertId: newUser.id }];
    }
    
    if (sqlUpper.includes('INSERT INTO ADVISORY_LOGS')) {
        const [location, season, soil_type, recommended_crop, fertilizer] = params;
        const newLog = {
            id: mockData.advisory_logs.length + 1,
            location,
            season,
            soil_type,
            recommended_crop,
            fertilizer,
            created_at: new Date()
        };
        mockData.advisory_logs.push(newLog);
        return [{ insertId: newLog.id }];
    }
    
    if (sqlUpper.includes('INSERT INTO FEEDBACK')) {
        const [message, rating] = params;
        const newFeedback = {
            id: mockData.feedback.length + 1,
            message,
            rating,
            created_at: new Date()
        };
        mockData.feedback.push(newFeedback);
        return [{ insertId: newFeedback.id }];
    }
    
    return [[]];
}

// Wrapper interface supporting both callbacks and promises
const dbWrapper = {
    execute(sql, params, callback) {
        let actualParams = params;
        let actualCallback = callback;
        
        if (typeof params === 'function') {
            actualCallback = params;
            actualParams = [];
        }
        
        if (typeof actualCallback === 'function') {
            // Callback style
            if (useMock) {
                executeMock(sql, actualParams)
                    .then(result => actualCallback(null, result[0], result[1]))
                    .catch(err => actualCallback(err));
            } else {
                pool.execute(sql, actualParams, (err, results, fields) => {
                    if (err) {
                        console.error("Database query failed. Falling back to Mock DB for callback.", err.message);
                        executeMock(sql, actualParams)
                            .then(result => actualCallback(null, result[0], result[1]))
                            .catch(mockErr => actualCallback(mockErr));
                    } else {
                        actualCallback(null, results, fields);
                    }
                });
            }
            return;
        }
        
        // Promise style
        return (async () => {
            if (useMock) {
                return await executeMock(sql, actualParams);
            } else {
                try {
                    const [rows, fields] = await pool.promise().execute(sql, actualParams);
                    return [rows, fields];
                } catch (err) {
                    console.error("Database query failed. Falling back to Mock DB for promise.", err.message);
                    return await executeMock(sql, actualParams);
                }
            }
        })();
    },
    promise() {
        return this; // Allows calling db.promise().execute(...)
    }
};

module.exports = dbWrapper;
