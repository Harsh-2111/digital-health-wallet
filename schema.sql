-- Digital Health Wallet - Database Schema
-- Run this file once to set up your MySQL database

CREATE DATABASE IF NOT EXISTS digital_health_wallet;
USE digital_health_wallet;

-- Doctors table (hardcoded in app.js before, now in DB)
CREATE TABLE IF NOT EXISTS doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients table
CREATE TABLE IF NOT EXISTS patients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uhid VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    aadhar VARCHAR(12) UNIQUE,
    phone VARCHAR(15),
    dob DATE,
    gender ENUM('male', 'female', 'other'),
    region TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Medical records table (one patient can have many records)
CREATE TABLE IF NOT EXISTS medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uhid VARCHAR(10) NOT NULL,
    symptoms TEXT,
    diagnosis TEXT,
    prescriptions TEXT,
    added_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (uhid) REFERENCES patients(uhid) ON DELETE CASCADE
);

