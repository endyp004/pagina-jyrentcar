const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const sharp = require('sharp');
const { pool, initializeDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_123';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Serve uploads statically (fallback if Nginx isn't used)
app.use('/uploads', express.static(UPLOADS_DIR));

// Configure Multer (Store in memory temporarily)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

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

app.post('/api/cars', verifyToken, upload.single('imageFile'), async (req, res) => {
    const { id, brand, model, year, type, price, features } = req.body;
    let imagePath = req.body.image; // Fallback to existing path or base64 if no new file

    try {
        if (req.file) {
            const filename = `car_${Date.now()}.webp`;
            const filepath = path.join(UPLOADS_DIR, filename);

            await sharp(req.file.buffer)
                .resize(1200, 800, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: 80 })
                .toFile(filepath);
            
            imagePath = `uploads/${filename}`;
        }

        await pool.query(
            'INSERT INTO cars (id, brand, model, year, type, price, image, features) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE brand=?, model=?, year=?, type=?, price=?, image=?, features=?',
            [id, brand, model, year, type, price, imagePath, features, brand, model, year, type, price, imagePath, features]
        );
        res.json({ success: true, image: imagePath });
    } catch (err) {
        console.error('Upload Error:', err);
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

// --- User Management Routes ---
app.get('/api/users', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, username, role, created_at FROM users');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/users', verifyToken, async (req, res) => {
    const { id, username, password, role } = req.body;
    try {
        if (id) {
            // Update
            if (password) {
                const hashed = await bcrypt.hash(password, 10);
                await pool.query('UPDATE users SET username=?, password=?, role=? WHERE id=?', [username, hashed, role, id]);
            } else {
                await pool.query('UPDATE users SET username=?, role=? WHERE id=?', [username, role, id]);
            }
        } else {
            // Create
            const hashed = await bcrypt.hash(password, 10);
            await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashed, role]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/users/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        // Prevent deleting original admin (id=1 usually, but let's check username too)
        const [user] = await pool.query('SELECT username FROM users WHERE id = ?', [id]);
        if (user.length > 0 && user[0].username === 'admin') {
            return res.status(403).json({ error: 'No se puede eliminar el usuario administrador principal.' });
        }
        await pool.query('DELETE FROM users WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Database Initialization & Startup ---
async function startServer() {
    let retries = 5;
    while (retries > 0) {
        try {
            await initializeDB();
            
            // Seed or Reset Initial User
            const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', ['admin']);
            const hashedPwd = await bcrypt.hash('1234', 10);
            if (rows.length === 0) {
                await pool.query('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPwd, 'Super Admin']);
                console.log('👤 Default admin user created (admin / 1234)');
            } else {
                await pool.query('UPDATE users SET password = ? WHERE username = ?', [hashedPwd, 'admin']);
                console.log('👤 Admin password reset to default (1234)');
            }

            app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
            return; // Success!
        } catch (err) {
            console.error(`⚠️ Connection attempt failed. Retries left: ${retries - 1}`);
            retries--;
            if (retries === 0) {
                console.error('❌ Critical error: Max retries reached during startup.');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, 5000)); // Wait 5 seconds
        }
    }
}

startServer();
