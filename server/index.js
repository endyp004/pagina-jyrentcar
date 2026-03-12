const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { pool, initializeDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Auth Routes ---
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });

        const user = rows[0];
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token, username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.userId = decoded.id;
        next();
    });
};

// --- Cars Routes ---
app.get('/api/cars', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM cars');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cars', verifyToken, async (req, res) => {
    const { id, brand, model, year, type, price, image, features } = req.body;
    try {
        await pool.query(
            'INSERT INTO cars (id, brand, model, year, type, price, image, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE brand=?, model=?, year=?, type=?, price=?, image=?, features=?',
            [id, brand, model, year, type, price, image, features, brand, model, year, type, price, image, features]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/cars/:id', verifyToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM cars WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Reservations Routes ---
app.get('/api/reservations', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM reservations ORDER BY timestamp DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reservations', async (req, res) => {
    const { carName, customerName, customerPhone, startDate, days, total, timestamp } = req.body;
    try {
        await pool.query(
            'INSERT INTO reservations (carName, customerName, customerPhone, startDate, days, total, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [carName, customerName, customerPhone, startDate, days, total, timestamp]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/reservations/:id', verifyToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM reservations WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Database Initialization & Startup ---
async function startServer() {
    try {
        await initializeDB();
        
        // Seed or Reset Initial User
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', ['admin']);
        const hashedPwd = await bcrypt.hash('1234', 10);
        if (rows.length === 0) {
            await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPwd, 'Super Admin']);
            console.log('👤 Default admin user created (admin / 1234)');
        } else {
            // Update to ensure the password is what the user expects (1234)
            await pool.query('UPDATE users SET password = ? WHERE username = ?', [hashedPwd, 'admin']);
            console.log('👤 Admin password reset to default (1234)');
        }

        app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
    } catch (err) {
        console.error('❌ Critical error during startup:', err);
        process.exit(1);
    }
}

startServer();
