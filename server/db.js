const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'jy_user',
    password: process.env.DB_PASSWORD || 'jy_password',
    database: process.env.DB_NAME || 'jy_rentcar',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initializeDB() {
    try {
        const connection = await pool.getConnection();
        
        // Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'Admin',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Cars Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS cars (
                id VARCHAR(50) PRIMARY KEY,
                brand VARCHAR(50) NOT NULL,
                model VARCHAR(50) NOT NULL,
                year INT NOT NULL,
                type VARCHAR(20) NOT NULL,
                price DECIMAL(10,2) NOT NULL,
                image TEXT,
                features TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Reservations Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                carName VARCHAR(100) NOT NULL,
                customerName VARCHAR(100) NOT NULL,
                customerPhone VARCHAR(20) NOT NULL,
                startDate DATE NOT NULL,
                days INT NOT NULL,
                total VARCHAR(20) NOT NULL,
                timestamp BIGINT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        connection.release();
        console.log('✅ Database tables initialized successfully.');
    } catch (error) {
        console.error('❌ Error initializing database:', error);
    }
}

module.exports = { pool, initializeDB };
