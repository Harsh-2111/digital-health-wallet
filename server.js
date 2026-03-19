// server.js — Digital Health Wallet Backend
// Run: node server.js

const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ─── Database Connection Pool ─────────────────────────────────────────────────
const pool = mysql.createPool({
    host:               process.env.DB_HOST,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
});

// Test DB on startup
pool.getConnection()
    .then(conn => { console.log('MySQL connected.'); conn.release(); })
    .catch(err  => console.error('MySQL connection failed:', err.message));


// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
// Attach this to any route that should only be accessed by logged-in doctors
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'No token. Access denied.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.doctor = decoded; // { id, name, username }
        next();
    });
}


// ─── ROUTE 1: Doctor Login ────────────────────────────────────────────────────
// POST /api/login
// Body: { username, password }
// Returns: { token, doctorName }
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ error: 'Username and password required.' });

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM doctors WHERE username = ?', [username]
        );

        if (rows.length === 0)
            return res.status(401).json({ error: 'Invalid credentials. Access denied.' });

        const doctor = rows[0];
        const passwordMatch = await bcrypt.compare(password, doctor.password_hash);

        if (!passwordMatch)
            return res.status(401).json({ error: 'Invalid credentials. Access denied.' });

        const token = jwt.sign(
            { id: doctor.id, name: doctor.name, username: doctor.username },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({ token, doctorName: doctor.name });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during login.' });
    }
});


// ─── ROUTE 2: Register Patient ────────────────────────────────────────────────
// POST /api/patients/register
// Body: { name, email, aadhar, phone, dob, gender, region }
// Returns: { uhid, message }
app.post('/api/patients/register', async (req, res) => {
    const { name, email, aadhar, phone, dob, gender, region } = req.body;

    if (!name || !aadhar)
        return res.status(400).json({ error: 'Name and Aadhar are required.' });

    try {
        // Check if Aadhar already registered
        const [existing] = await pool.execute(
            'SELECT uhid FROM patients WHERE aadhar = ?', [aadhar]
        );

        if (existing.length > 0)
            return res.status(409).json({
                error: `Aadhar already registered. UHID: ${existing[0].uhid}`
            });

        // Generate unique UHID (4-digit, retry if collision)
        let uhid;
        let isUnique = false;
        while (!isUnique) {
            uhid = Math.floor(1000 + Math.random() * 9000).toString();
            const [check] = await pool.execute(
                'SELECT id FROM patients WHERE uhid = ?', [uhid]
            );
            if (check.length === 0) isUnique = true;
        }

        await pool.execute(
            `INSERT INTO patients (uhid, name, email, aadhar, phone, dob, gender, region)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [uhid, name, email || null, aadhar, phone || null, dob || null, gender || null, region || null]
        );

        res.status(201).json({ uhid, message: 'Patient registered successfully.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});


// ─── ROUTE 3: Search Patient by UHID ─────────────────────────────────────────
// GET /api/records/:uhid
// Headers: Authorization: Bearer <token>
// Returns: { patient, records[] }
app.get('/api/records/:uhid', verifyToken, async (req, res) => {
    const { uhid } = req.params;

    try {
        const [patients] = await pool.execute(
            'SELECT * FROM patients WHERE uhid = ?', [uhid]
        );

        if (patients.length === 0)
            return res.status(404).json({ error: `No patient found with UHID: ${uhid}` });

        const [records] = await pool.execute(
            'SELECT * FROM medical_records WHERE uhid = ? ORDER BY created_at DESC', [uhid]
        );

        res.json({ patient: patients[0], records });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching records.' });
    }
});


// ─── ROUTE 4: Add Medical Record ─────────────────────────────────────────────
// POST /api/records
// Headers: Authorization: Bearer <token>
// Body: { uhid, symptoms, diagnosis, prescriptions }
// Returns: { message, recordId }
app.post('/api/records', verifyToken, async (req, res) => {
    const { uhid, symptoms, diagnosis, prescriptions } = req.body;

    if (!uhid || !diagnosis)
        return res.status(400).json({ error: 'UHID and diagnosis are required.' });

    try {
        // Verify patient exists
        const [patients] = await pool.execute(
            'SELECT id FROM patients WHERE uhid = ?', [uhid]
        );

        if (patients.length === 0)
            return res.status(404).json({ error: `No patient found with UHID: ${uhid}` });

        const [result] = await pool.execute(
            `INSERT INTO medical_records (uhid, symptoms, diagnosis, prescriptions, added_by)
             VALUES (?, ?, ?, ?, ?)`,
            [uhid, symptoms || null, diagnosis, prescriptions || null, req.doctor.name]
        );

        res.status(201).json({
            message: 'Record added successfully.',
            recordId: result.insertId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error adding record.' });
    }
});


// ─── ROUTE 5: Delete Medical Record ──────────────────────────────────────────
// DELETE /api/records/:id
// Headers: Authorization: Bearer <token>
// Returns: { message }
app.delete('/api/records/:id', verifyToken, async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.execute(
            'DELETE FROM medical_records WHERE id = ?', [id]
        );

        if (result.affectedRows === 0)
            return res.status(404).json({ error: 'Record not found.' });

        res.json({ message: 'Record deleted successfully.' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error deleting record.' });
    }
});


// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`DHW server running on http://localhost:${PORT}`);
    
    // Auto-seed doctors with correct hashed passwords
    try {
        const doctors = [
            { name: 'Dr. Harsh Savalia', username: 'harsh',   password: 'pass123'    },
            { name: 'Dr. Khush',         username: 'khush',   password: 'khush123'   },
            { name: 'Dr. Naiya',         username: 'naiya',   password: 'naiya123'   },
            { name: 'Dr. Pratha',        username: 'pratha',  password: 'pratha123'  },
            { name: 'Dr. Nishtha',       username: 'nishtha', password: 'nishtha123' },
        ];
        for (const doc of doctors) {
            const hash = await bcrypt.hash(doc.password, 10);
            await pool.execute(
                `INSERT INTO doctors (name, username, password_hash) 
                 VALUES (?, ?, ?) 
                 ON DUPLICATE KEY UPDATE password_hash = ?`,
                [doc.name, doc.username, hash, hash]
            );
        }
        console.log('Doctors seeded successfully.');
    } catch (err) {
        console.error('Seeding error:', err.message);
    }
});
