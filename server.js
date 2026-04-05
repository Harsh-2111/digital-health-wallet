// server.js — Digital Health Wallet Backend
// Database: Supabase (PostgreSQL)
// Run: node server.js

const express = require('express');
const { Pool } = require('pg');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
require('dotenv').config();

const app = express();
app.use(cors({
    origin: ['https://harsh-2111.github.io', 'http://localhost:3000', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── PostgreSQL Connection Pool ───────────────────────────────────────────────
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(client => { console.log('PostgreSQL connected.'); client.release(); })
    .catch(err   => console.error('PostgreSQL connection failed:', err.message));


// ─── JWT Auth Middleware ──────────────────────────────────────────────────────
function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token. Access denied.' });
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.doctor = decoded;
        next();
    });
}


// ─── ROUTE 1: Doctor Login ────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
        return res.status(400).json({ error: 'Username and password required.' });
    try {
        const result = await pool.query('SELECT * FROM doctors WHERE username = $1', [username]);
        if (result.rows.length === 0)
            return res.status(401).json({ error: 'Invalid credentials. Access denied.' });
        const doctor = result.rows[0];
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
app.post('/api/patients/register', async (req, res) => {
    const { name, email, aadhar, phone, dob, gender, region } = req.body;
    if (!name || !aadhar)
        return res.status(400).json({ error: 'Name and Aadhar are required.' });
    try {
        const existing = await pool.query('SELECT uhid FROM patients WHERE aadhar = $1', [aadhar]);
        if (existing.rows.length > 0)
            return res.status(409).json({ error: `Aadhar already registered. UHID: ${existing.rows[0].uhid}` });

        let uhid, isUnique = false;
        while (!isUnique) {
            uhid = Math.floor(1000 + Math.random() * 9000).toString();
            const check = await pool.query('SELECT id FROM patients WHERE uhid = $1', [uhid]);
            if (check.rows.length === 0) isUnique = true;
        }

        await pool.query(
            `INSERT INTO patients (uhid, name, email, aadhar, phone, dob, gender, region)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [uhid, name, email||null, aadhar, phone||null, dob||null, gender||null, region||null]
        );
        res.status(201).json({ uhid, message: 'Patient registered successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error during registration.' });
    }
});


// ─── ROUTE 3: Search Patient by UHID ─────────────────────────────────────────
app.get('/api/records/:uhid', verifyToken, async (req, res) => {
    const { uhid } = req.params;
    try {
        const patients = await pool.query('SELECT * FROM patients WHERE uhid = $1', [uhid]);
        if (patients.rows.length === 0)
            return res.status(404).json({ error: `No patient found with UHID: ${uhid}` });
        const records = await pool.query(
            'SELECT * FROM medical_records WHERE uhid = $1 ORDER BY created_at DESC', [uhid]
        );
        res.json({ patient: patients.rows[0], records: records.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error fetching records.' });
    }
});


// ─── ROUTE 4: Add Medical Record ─────────────────────────────────────────────
app.post('/api/records', verifyToken, async (req, res) => {
    const { uhid, symptoms, diagnosis, prescriptions } = req.body;
    if (!uhid || !diagnosis)
        return res.status(400).json({ error: 'UHID and diagnosis are required.' });
    try {
        const patients = await pool.query('SELECT id FROM patients WHERE uhid = $1', [uhid]);
        if (patients.rows.length === 0)
            return res.status(404).json({ error: `No patient found with UHID: ${uhid}` });
        const result = await pool.query(
            `INSERT INTO medical_records (uhid, symptoms, diagnosis, prescriptions, added_by)
             VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [uhid, symptoms||null, diagnosis, prescriptions||null, req.doctor.name]
        );
        res.status(201).json({ message: 'Record added successfully.', recordId: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error adding record.' });
    }
});


// ─── ROUTE 5: Delete Medical Record ──────────────────────────────────────────
app.delete('/api/records/:id', verifyToken, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM medical_records WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0)
            return res.status(404).json({ error: 'Record not found.' });
        res.json({ message: 'Record deleted successfully.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error deleting record.' });
    }
});


// ─── Start Server + Seed Doctors ─────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`DHW server running on port ${PORT}`);
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
            await pool.query(
                `INSERT INTO doctors (name, username, password_hash) VALUES ($1,$2,$3)
                 ON CONFLICT (username) DO NOTHING`,
                [doc.name, doc.username, hash]
            );
        }
        console.log('Doctors seeded successfully.');
    } catch (err) {
        console.error('Seeding error:', err.message);
    }
});
