-- ============================================================================
-- MODULE 3: BILL OF ENTRY (BoE) AUTO-FILL & EDITOR
-- Database Schema for Indian Customs Bill of Entry Management
-- ============================================================================
-- Author: OrbisPorté Development Team
-- Company: SPECTRA AI PTE. LTD., Singapore
-- Date: 2026-03-01
-- ============================================================================

-- ============================================================================
-- Table: bills_of_entry
-- Purpose: Main table for Bill of Entry documents
-- ============================================================================
CREATE TABLE IF NOT EXISTS bills_of_entry (
    id SERIAL PRIMARY KEY,
    boe_number VARCHAR(20) UNIQUE,                    -- e.g., "MUM/IMP/2026/123456"
    boe_date DATE,

    -- Foreign Keys
    user_id INTEGER NOT NULL REFERENCES "User"(id),
    company_id INTEGER REFERENCES "Company"(id),
    document_id INTEGER REFERENCES "ProcessedDocuments"(id),

    -- Port & Location Information
    port_code VARCHAR(10),                            -- e.g., "INMAA1" (Mumbai)
    port_name VARCHAR(100),
    customs_house VARCHAR(100),

    -- Importer Information
    importer_name VARCHAR(200),
    importer_address TEXT,
    importer_iec VARCHAR(10),
    importer_gst VARCHAR(15),
    importer_pan VARCHAR(10),

    -- Shipment Information
    bill_of_lading_number VARCHAR(50),
    bill_of_lading_date DATE,
    vessel_name VARCHAR(100),
    country_of_origin VARCHAR(3),                     -- ISO 3-letter code
    country_of_consignment VARCHAR(3),

    -- Financial Information (All in INR)
    total_invoice_value NUMERIC(15, 2),
    freight_charges NUMERIC(15, 2),
    insurance_charges NUMERIC(15, 2),
    total_cif_value NUMERIC(15, 2),                   -- CIF = Cost + Insurance + Freight
    total_assessable_value NUMERIC(15, 2),

    -- Duty Summary (from duty_calculator)
    total_bcd NUMERIC(15, 2) DEFAULT 0,
    total_cess NUMERIC(15, 2) DEFAULT 0,
    total_igst NUMERIC(15, 2) DEFAULT 0,
    total_sws NUMERIC(15, 2) DEFAULT 0,
    total_add NUMERIC(15, 2) DEFAULT 0,
    total_cvd NUMERIC(15, 2) DEFAULT 0,
    total_duty NUMERIC(15, 2),
    total_amount_payable NUMERIC(15, 2),

    -- Exchange Rate
    currency_code VARCHAR(3) DEFAULT 'INR',
    exchange_rate NUMERIC(10, 4) DEFAULT 1.0000,

    -- Status & Workflow
    status VARCHAR(20) DEFAULT 'draft',               -- draft, validated, submitted, approved, rejected
    validation_status VARCHAR(20) DEFAULT 'pending',  -- pending, passed, failed
    validation_errors JSONB,
    risk_score NUMERIC(5, 2),                         -- 0-100 (for auto-sign vs manual review)

    -- Version Control
    version_number INTEGER DEFAULT 1,
    is_current_version BOOLEAN DEFAULT TRUE,
    parent_boe_id INTEGER REFERENCES bills_of_entry(id),

    -- Filing Information
    filing_status VARCHAR(20),                        -- not_filed, filed, accepted, rejected
    icegate_reference_number VARCHAR(50),
    icegate_filing_date TIMESTAMP,
    icegate_response JSONB,

    -- Audit Trail
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES "User"(id),
    approved_by INTEGER REFERENCES "User"(id),
    approved_at TIMESTAMP,

    -- Full BoE JSON (for flexibility)
    boe_json JSONB,

    -- Metadata
    notes TEXT,
    tags VARCHAR(100)[]
);

-- Indexes for bills_of_entry
CREATE INDEX idx_boe_user ON bills_of_entry(user_id);
CREATE INDEX idx_boe_company ON bills_of_entry(company_id);
CREATE INDEX idx_boe_document ON bills_of_entry(document_id);
CREATE INDEX idx_boe_status ON bills_of_entry(status);
CREATE INDEX idx_boe_port ON bills_of_entry(port_code);
CREATE INDEX idx_boe_date ON bills_of_entry(boe_date);
CREATE INDEX idx_boe_number ON bills_of_entry(boe_number);


-- ============================================================================
-- Table: boe_line_items
-- Purpose: Individual line items within a Bill of Entry
-- ============================================================================
CREATE TABLE IF NOT EXISTS boe_line_items (
    id SERIAL PRIMARY KEY,
    boe_id INTEGER NOT NULL REFERENCES bills_of_entry(id) ON DELETE CASCADE,

    -- Line Item Information
    line_number INTEGER NOT NULL,                     -- Sequential line number

    -- Product Details
    product_description TEXT NOT NULL,
    hsn_code VARCHAR(10) NOT NULL,
    hsn_description TEXT,

    -- Quantity & Units
    quantity NUMERIC(15, 3),
    unit VARCHAR(10),                                 -- KG, PCS, MTR, LTR, etc.
    gross_weight_kg NUMERIC(15, 3),
    net_weight_kg NUMERIC(15, 3),

    -- Value Information (in invoice currency)
    unit_price NUMERIC(15, 4),
    total_value NUMERIC(15, 2),

    -- CIF Breakdown for this line
    freight_allocation NUMERIC(15, 2),
    insurance_allocation NUMERIC(15, 2),
    cif_value NUMERIC(15, 2),

    -- Duty Calculation Reference
    duty_calculation_uuid UUID,                       -- Links to duty_calculations table
    assessable_value NUMERIC(15, 2),

    -- Duty Components for this line item
    bcd_rate NUMERIC(5, 2),
    bcd_amount NUMERIC(15, 2),
    cess_rate NUMERIC(5, 2),
    cess_amount NUMERIC(15, 2),
    igst_rate NUMERIC(5, 2),
    igst_amount NUMERIC(15, 2),
    sws_rate NUMERIC(5, 2),
    sws_amount NUMERIC(15, 2),
    add_rate NUMERIC(5, 2),
    add_amount NUMERIC(15, 2),
    cvd_rate NUMERIC(5, 2),
    cvd_amount NUMERIC(15, 2),
    total_duty NUMERIC(15, 2),

    -- Additional Fields
    country_of_origin VARCHAR(3),
    fta_applicable BOOLEAN DEFAULT FALSE,
    fta_scheme_name VARCHAR(100),
    exemption_notification VARCHAR(100),

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for boe_line_items
CREATE INDEX idx_boe_line_boe ON boe_line_items(boe_id);
CREATE INDEX idx_boe_line_hsn ON boe_line_items(hsn_code);
CREATE INDEX idx_boe_line_duty_calc ON boe_line_items(duty_calculation_uuid);


-- ============================================================================
-- Table: boe_versions
-- Purpose: Track version history of Bill of Entry edits
-- ============================================================================
CREATE TABLE IF NOT EXISTS boe_versions (
    id SERIAL PRIMARY KEY,
    boe_id INTEGER NOT NULL REFERENCES bills_of_entry(id) ON DELETE CASCADE,

    -- Version Information
    version_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES "User"(id),

    -- Snapshot of BoE at this version
    boe_snapshot JSONB NOT NULL,
    line_items_snapshot JSONB,

    -- Change Information
    change_summary TEXT,
    changed_fields VARCHAR(100)[],

    -- Metadata
    ip_address INET,
    user_agent TEXT
);

CREATE INDEX idx_boe_version_boe ON boe_versions(boe_id);
CREATE INDEX idx_boe_version_created ON boe_versions(created_at);


-- ============================================================================
-- Table: boe_validation_rules
-- Purpose: Configurable validation rules for BoE fields
-- ============================================================================
CREATE TABLE IF NOT EXISTS boe_validation_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL UNIQUE,
    rule_type VARCHAR(50) NOT NULL,                  -- required, format, range, cross_field
    field_name VARCHAR(100),

    -- Rule Configuration
    rule_config JSONB,                                -- Flexible rule parameters
    error_message TEXT,
    severity VARCHAR(20) DEFAULT 'error',             -- error, warning, info

    -- Applicability
    port_code VARCHAR(10),                            -- NULL = applies to all ports
    active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- Table: port_configurations
-- Purpose: Port-specific field mappings and requirements
-- ============================================================================
CREATE TABLE IF NOT EXISTS port_configurations (
    id SERIAL PRIMARY KEY,
    port_code VARCHAR(10) NOT NULL UNIQUE,
    port_name VARCHAR(100) NOT NULL,
    customs_house VARCHAR(100),

    -- Schema Configuration
    field_mapping JSONB,                              -- Map internal fields to port-specific fields
    required_fields VARCHAR(100)[],
    optional_fields VARCHAR(100)[],

    -- Filing Configuration
    filing_method VARCHAR(20),                        -- api, sftp, web_form
    api_endpoint VARCHAR(255),
    sftp_host VARCHAR(255),
    sftp_port INTEGER,

    -- Metadata
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- Insert default port configurations
-- ============================================================================
INSERT INTO port_configurations (port_code, port_name, customs_house, required_fields, filing_method)
VALUES
    ('INMAA1', 'Mumbai (Nhava Sheva)', 'JNCH Customs House',
     ARRAY['importer_iec', 'importer_gst', 'bill_of_lading_number', 'country_of_origin'], 'api'),
    ('INCCU1', 'Kolkata', 'Kolkata Customs House',
     ARRAY['importer_iec', 'importer_gst', 'bill_of_lading_number', 'country_of_origin'], 'api'),
    ('INMAA4', 'Chennai', 'Chennai Customs House',
     ARRAY['importer_iec', 'importer_gst', 'bill_of_lading_number', 'country_of_origin'], 'api'),
    ('INBLR4', 'Bangalore Air Cargo', 'Bangalore Air Customs',
     ARRAY['importer_iec', 'importer_gst', 'bill_of_lading_number', 'country_of_origin'], 'api')
ON CONFLICT (port_code) DO NOTHING;


-- ============================================================================
-- Insert basic validation rules
-- ============================================================================
INSERT INTO boe_validation_rules (rule_name, rule_type, field_name, rule_config, error_message, severity)
VALUES
    ('iec_required', 'required', 'importer_iec', '{}', 'IEC number is required', 'error'),
    ('iec_format', 'format', 'importer_iec', '{"pattern": "^[0-9]{10}$"}', 'IEC must be 10 digits', 'error'),
    ('gst_format', 'format', 'importer_gst', '{"pattern": "^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"}', 'Invalid GST format', 'error'),
    ('boe_date_not_future', 'range', 'boe_date', '{"max": "today"}', 'BoE date cannot be in the future', 'error'),
    ('total_duty_positive', 'range', 'total_duty', '{"min": 0}', 'Total duty must be non-negative', 'error'),
    ('hsn_code_required', 'required', 'hsn_code', '{}', 'HSN code is required for all line items', 'error')
ON CONFLICT (rule_name) DO NOTHING;


-- ============================================================================
-- Update trigger for updated_at timestamp
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_boe_updated_at BEFORE UPDATE ON bills_of_entry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_boe_line_updated_at BEFORE UPDATE ON boe_line_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_port_config_updated_at BEFORE UPDATE ON port_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_validation_rules_updated_at BEFORE UPDATE ON boe_validation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================================
-- Grants (adjust based on your user roles)
-- ============================================================================
-- GRANT SELECT, INSERT, UPDATE, DELETE ON bills_of_entry TO orbisporte_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON boe_line_items TO orbisporte_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON boe_versions TO orbisporte_app;
-- GRANT SELECT ON boe_validation_rules TO orbisporte_app;
-- GRANT SELECT ON port_configurations TO orbisporte_app;

-- ============================================================================
-- End of migration
-- ============================================================================
