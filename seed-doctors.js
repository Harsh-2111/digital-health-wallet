// seed-doctors.js
// Run once: node seed-doctors.js
// This inserts all 5 doctors with properly hashed passwords into MySQL

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
require('dotenv').config();

const doctors = [
    { name: 'Dr. Harsh Savalia', username: 'harsh',   password: 'pass123'    },
    { name: 'Dr. Khush',         username: 'khush',   password: 'khush123'   },
    { name: 'Dr. Naiya',         username: 'naiya',   password: 'naiya123'   },
    { name: 'Dr. Pratha',        username: 'pratha',  password: 'pratha123'  },
    { name: 'Dr. Nishtha',       username: 'nishtha', password: 'nishtha123' },
];

async function seed() {
    const db = await mysql.createConnection({
        host:     process.env.DB_HOST,
        user:     process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    for (const doc of doctors) {
        const hash = await bcrypt.hash(doc.password, 10);
        await db.execute(
            `INSERT IGNORE INTO doctors (name, username, password_hash) VALUES (?, ?, ?)`,
            [doc.name, doc.username, hash]
        );
        console.log(`Inserted: ${doc.username}`);
    }

    console.log('All doctors seeded successfully.');
    await db.end();
}

seed().catch(console.error);
