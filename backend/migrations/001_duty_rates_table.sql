-- Migration: Create duty_rates table for Module 5 (Duty Calculator)
-- Purpose: Store duty rates (BCD, IGST, CESS, etc.) for different HSN codes
-- Date: 2026-02-22
-- Project: OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform

-- Create duty_rates table
CREATE TABLE IF NOT EXISTS duty_rates (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(10) NOT NULL,
    hsn_description TEXT,
    duty_type VARCHAR(20) NOT NULL,  -- BCD, IGST, CESS, ADD, CVD, SWS
    rate_percent DECIMAL(5,2) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,  -- NULL means currently active
    notification_number VARCHAR(100),
    notification_date DATE,
    legal_priority INTEGER DEFAULT 1,  -- Higher number = higher priority
    port_code VARCHAR(10),  -- NULL means applies to all ports
    country_of_origin VARCHAR(3),  -- ISO 3-letter code, NULL means all countries
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    notes TEXT
);

-- Create index for fast lookups
CREATE INDEX idx_duty_rates_hsn ON duty_rates(hsn_code);
CREATE INDEX idx_duty_rates_effective ON duty_rates(effective_from, effective_to);
CREATE INDEX idx_duty_rates_type ON duty_rates(duty_type);
CREATE INDEX idx_duty_rates_active ON duty_rates(hsn_code, duty_type) WHERE effective_to IS NULL;

-- Create duty_calculations table to store calculation history
CREATE TABLE IF NOT EXISTS duty_calculations (
    id SERIAL PRIMARY KEY,
    calculation_uuid UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    user_id INTEGER,  -- Will add foreign key later when users table exists
    document_id INTEGER,  -- Will add foreign key later when processedfiles table exists

    -- Input parameters
    hsn_code VARCHAR(10) NOT NULL,
    cif_value DECIMAL(12,2) NOT NULL,
    quantity DECIMAL(10,3),
    unit VARCHAR(20),
    port_code VARCHAR(10),
    country_of_origin VARCHAR(3),
    currency VARCHAR(3) DEFAULT 'INR',
    exchange_rate DECIMAL(10,4) DEFAULT 1.0000,

    -- Calculated duty components (all in INR)
    bcd_rate DECIMAL(5,2),
    bcd_amount DECIMAL(12,2),
    cess_rate DECIMAL(5,2),
    cess_amount DECIMAL(12,2),
    igst_rate DECIMAL(5,2),
    igst_amount DECIMAL(12,2),
    sws_rate DECIMAL(5,2),  -- Social Welfare Surcharge
    sws_amount DECIMAL(12,2),
    add_rate DECIMAL(5,2),  -- Anti-Dumping Duty
    add_amount DECIMAL(12,2),
    cvd_rate DECIMAL(5,2),  -- Countervailing Duty
    cvd_amount DECIMAL(12,2),

    -- Derived values
    assessable_value DECIMAL(12,2),
    total_duty DECIMAL(12,2),

    -- Audit trail
    calculation_formula TEXT,  -- Human-readable formula breakdown
    duty_rate_ids INTEGER[],  -- Array of duty_rates.id used in calculation

    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    calculation_time_ms INTEGER,  -- Performance tracking

    -- Validation
    is_validated BOOLEAN DEFAULT FALSE,
    validated_by VARCHAR(100),
    validated_at TIMESTAMP,
    validation_notes TEXT
);

-- Create index for user history lookup
CREATE INDEX idx_duty_calculations_user ON duty_calculations(user_id, calculated_at DESC);
CREATE INDEX idx_duty_calculations_document ON duty_calculations(document_id);
CREATE INDEX idx_duty_calculations_hsn ON duty_calculations(hsn_code);

-- Insert sample duty rates for common HSN codes (India Customs 2026)
-- These are sample rates - should be updated from official CBIC notifications

-- Electronics - Laptops (HSN: 8471)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8471', 'Automatic data processing machines (laptops, computers)', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8471', 'Automatic data processing machines (laptops, computers)', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Textiles - Cotton T-shirts (HSN: 6109)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6109', 'T-shirts, singlets and other vests, knitted', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6109', 'T-shirts, singlets and other vests, knitted', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Machinery - Industrial equipment (HSN: 8479)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8479', 'Machines and mechanical appliances', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8479', 'Machines and mechanical appliances', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Chemicals - Organic chemicals (HSN: 2918)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('2918', 'Carboxylic acids with additional oxygen function', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('2918', 'Carboxylic acids with additional oxygen function', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Mobile Phones (HSN: 8517)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8517', 'Telephone sets, including smartphones', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8517', 'Telephone sets, including smartphones', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Automobiles - Cars (HSN: 8703)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8703', 'Motor cars and other motor vehicles', 'BCD', 125.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8703', 'Motor cars and other motor vehicles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017'),
('8703', 'Motor cars and other motor vehicles', 'CESS', 22.00, '2024-01-01', 'GST Compensation Cess');

-- Pharmaceuticals (HSN: 3004)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3004', 'Medicaments (excluding goods of heading 3002, 3005 or 3006)', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3004', 'Medicaments (excluding goods of heading 3002, 3005 or 3006)', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Steel Products (HSN: 7208)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7208', 'Flat-rolled products of iron or steel', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7208', 'Flat-rolled products of iron or steel', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Solar Panels (HSN: 8541)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8541', 'Solar cells and modules', 'BCD', 40.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8541', 'Solar cells and modules', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Furniture - Wooden (HSN: 9403)
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9403', 'Other furniture and parts thereof', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9403', 'Other furniture and parts thereof', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

COMMENT ON TABLE duty_rates IS 'Stores duty rates for different HSN codes and duty types (Module 5: Duty Calculator - OrbisPorté)';
COMMENT ON TABLE duty_calculations IS 'Stores history of all duty calculations performed by users (Module 5: Duty Calculator - OrbisPorté)';
