CREATE TABLE IF NOT EXISTS doctors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
    id SERIAL PRIMARY KEY,
    uhid VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    aadhar VARCHAR(12) UNIQUE,
    phone VARCHAR(15),
    dob DATE,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS medical_records (
    id SERIAL PRIMARY KEY,
    uhid VARCHAR(10) NOT NULL,
    symptoms TEXT,
    diagnosis TEXT NOT NULL,
    prescriptions TEXT,
    added_by VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    FOREIGN KEY (uhid) REFERENCES patients(uhid) ON DELETE CASCADE
);
