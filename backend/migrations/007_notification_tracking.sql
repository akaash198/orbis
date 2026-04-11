-- ============================================================================
-- MODULE 7: Dynamic Exemption & Notification Tracking
-- Purpose: Track customs notifications and auto-update duty rates
-- Author: OrbisPorté Development Team
-- Company: SPECTRA AI PTE. LTD., Singapore
-- Date: 2026-03-03
-- ============================================================================

-- Table 1: Customs Notifications
-- Stores raw notifications from CBIC gazette
CREATE TABLE IF NOT EXISTS customs_notifications (
    id SERIAL PRIMARY KEY,
    notification_number VARCHAR(100) UNIQUE NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'Customs', 'IGST', 'ADD', 'FTA', 'Exemption'
    title TEXT,
    issue_date DATE NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,  -- NULL means indefinite
    source_url TEXT,
    source_file_path TEXT,  -- Path to downloaded PDF
    raw_text TEXT,  -- OCR extracted text
    parsed_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'parsed', 'failed', 'reviewed'
    parsed_at TIMESTAMP,
    parsed_by INTEGER,  -- user_id who reviewed

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Audit
    created_by INTEGER,
    notes TEXT,

    CONSTRAINT chk_parsed_status CHECK (parsed_status IN ('pending', 'parsed', 'failed', 'reviewed'))
);

CREATE INDEX idx_notifications_number ON customs_notifications(notification_number);
CREATE INDEX idx_notifications_date ON customs_notifications(issue_date DESC);
CREATE INDEX idx_notifications_type ON customs_notifications(notification_type);
CREATE INDEX idx_notifications_status ON customs_notifications(parsed_status);
CREATE INDEX idx_notifications_effective ON customs_notifications(effective_from, effective_to);

COMMENT ON TABLE customs_notifications IS 'Stores CBIC customs notifications for tracking duty rate changes';
COMMENT ON COLUMN customs_notifications.notification_number IS 'Official notification number (e.g., "50/2024-Customs")';
COMMENT ON COLUMN customs_notifications.parsed_status IS 'Status of NLP parsing: pending, parsed, failed, or reviewed';


-- Table 2: Parsed Notification Items
-- Stores structured data extracted from notifications
CREATE TABLE IF NOT EXISTS notification_items (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES customs_notifications(id) ON DELETE CASCADE,
    item_sequence INTEGER NOT NULL,  -- Order within notification

    -- HSN/Product Information
    hsn_code_from VARCHAR(20),  -- Start of HSN range
    hsn_code_to VARCHAR(20),    -- End of HSN range (NULL if single code)
    product_description TEXT,

    -- Rate Changes
    duty_type VARCHAR(20),  -- 'BCD', 'IGST', 'CESS', 'ADD', 'CVD'
    old_rate NUMERIC(10, 4),  -- Previous rate (if available)
    new_rate NUMERIC(10, 4),  -- New rate
    rate_unit VARCHAR(20),  -- 'percent', 'specific', 'ad_valorem'

    -- Conditions
    country_of_origin VARCHAR(10),  -- ISO code (NULL if applies to all)
    importer_type VARCHAR(50),  -- 'all', 'eou', 'sez', etc.
    conditions TEXT,  -- Any special conditions

    -- Confidence Scores (from NLP parser)
    hsn_confidence NUMERIC(5, 4),  -- 0.0 to 1.0
    rate_confidence NUMERIC(5, 4),
    overall_confidence NUMERIC(5, 4),

    -- Flags
    requires_review BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_duty_type CHECK (duty_type IN ('BCD', 'IGST', 'CESS', 'ADD', 'CVD', 'SWS', 'CVD'))
);

CREATE INDEX idx_notification_items_notification ON notification_items(notification_id);
CREATE INDEX idx_notification_items_hsn ON notification_items(hsn_code_from, hsn_code_to);
CREATE INDEX idx_notification_items_duty_type ON notification_items(duty_type);
CREATE INDEX idx_notification_items_confidence ON notification_items(overall_confidence);
CREATE INDEX idx_notification_items_review ON notification_items(requires_review) WHERE requires_review = TRUE;

COMMENT ON TABLE notification_items IS 'Parsed items from notifications - HSN ranges and rate changes';
COMMENT ON COLUMN notification_items.hsn_confidence IS 'AI confidence in HSN code extraction (0-1)';


-- Table 3: Notification Conflicts
-- Tracks conflicting notifications for legal review
CREATE TABLE IF NOT EXISTS notification_conflicts (
    id SERIAL PRIMARY KEY,
    notification_id_1 INTEGER NOT NULL REFERENCES customs_notifications(id),
    notification_id_2 INTEGER NOT NULL REFERENCES customs_notifications(id),
    conflict_type VARCHAR(50) NOT NULL,  -- 'rate_mismatch', 'date_overlap', 'hsn_conflict'
    hsn_code VARCHAR(20),
    duty_type VARCHAR(20),
    description TEXT,
    severity VARCHAR(20) DEFAULT 'medium',  -- 'low', 'medium', 'high', 'critical'

    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by INTEGER,  -- user_id
    resolution_notes TEXT,
    winning_notification_id INTEGER REFERENCES customs_notifications(id),

    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_conflict_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT chk_different_notifications CHECK (notification_id_1 != notification_id_2)
);

CREATE INDEX idx_conflicts_unresolved ON notification_conflicts(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_conflicts_severity ON notification_conflicts(severity);
CREATE INDEX idx_conflicts_hsn ON notification_conflicts(hsn_code);

COMMENT ON TABLE notification_conflicts IS 'Tracks conflicting notifications requiring legal review';


-- Table 4: Duty Rate Versions (extends existing duty_rates table)
-- Links duty rates to notifications for audit trail
CREATE TABLE IF NOT EXISTS duty_rate_history (
    id SERIAL PRIMARY KEY,
    duty_rate_id INTEGER,  -- Links to duty_rates.id (if exists)
    notification_id INTEGER REFERENCES customs_notifications(id),
    notification_item_id INTEGER REFERENCES notification_items(id),

    -- Rate Information
    hsn_code VARCHAR(20) NOT NULL,
    duty_type VARCHAR(20) NOT NULL,
    rate_percent NUMERIC(10, 4) NOT NULL,

    -- Effective Dates
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Change Tracking
    previous_rate NUMERIC(10, 4),  -- Rate before this change
    change_type VARCHAR(20),  -- 'new', 'increased', 'decreased', 'removed'
    change_percentage NUMERIC(10, 4),  -- % change from previous rate

    -- Impact Tracking
    affected_boe_count INTEGER DEFAULT 0,  -- Number of BOEs affected
    affected_users_count INTEGER DEFAULT 0,
    alerts_sent INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,

    CONSTRAINT chk_change_type CHECK (change_type IN ('new', 'increased', 'decreased', 'removed', 'unchanged'))
);

CREATE INDEX idx_rate_history_hsn ON duty_rate_history(hsn_code, effective_from DESC);
CREATE INDEX idx_rate_history_notification ON duty_rate_history(notification_id);
CREATE INDEX idx_rate_history_dates ON duty_rate_history(effective_from, effective_to);

COMMENT ON TABLE duty_rate_history IS 'Complete history of duty rate changes with notification linkage';


-- Table 5: Notification Alerts
-- Track alerts sent to users when rates affecting their BOEs change
CREATE TABLE IF NOT EXISTS notification_alerts (
    id SERIAL PRIMARY KEY,
    notification_id INTEGER NOT NULL REFERENCES customs_notifications(id),
    user_id INTEGER NOT NULL,
    alert_type VARCHAR(50) NOT NULL,  -- 'rate_change', 'boe_affected', 'conflict_detected'

    -- Alert Content
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',  -- 'info', 'warning', 'critical'

    -- Affected Items
    affected_hsn_codes TEXT[],  -- Array of HSN codes
    affected_boe_ids INTEGER[],  -- Array of BOE IDs

    -- Delivery Status
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP,
    acknowledged_at TIMESTAMP,
    dismissed_at TIMESTAMP,

    -- Actions
    action_required BOOLEAN DEFAULT FALSE,
    action_url TEXT,
    action_taken_at TIMESTAMP,

    CONSTRAINT chk_alert_severity CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE INDEX idx_alerts_user ON notification_alerts(user_id, sent_at DESC);
CREATE INDEX idx_alerts_unread ON notification_alerts(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_alerts_notification ON notification_alerts(notification_id);

COMMENT ON TABLE notification_alerts IS 'Alerts sent to users about notification changes affecting their BOEs';


-- ============================================================================
-- SAMPLE DATA: Insert a sample notification for testing
-- ============================================================================

INSERT INTO customs_notifications (
    notification_number,
    notification_type,
    title,
    issue_date,
    effective_from,
    source_url,
    raw_text,
    parsed_status
) VALUES (
    '50/2024-Customs',
    'Customs',
    'Amendment to Customs Tariff - Electronic Goods',
    '2024-04-01',
    '2024-04-15',
    'https://www.cbic.gov.in/resources//htdocs-cbec/customs/cs-act/notifications/notfns-2024/cs-tarr2024/cs50-2024.pdf',
    'Notification No. 50/2024-Customs, dated 1st April, 2024

    In exercise of the powers conferred by sub-section (1) of section 25 of the Customs Act, 1962, the Central Government, being satisfied that it is necessary in the public interest so to do, hereby makes the following further amendments in the notification of the Government of India in the Ministry of Finance (Department of Revenue), No. 50/2017-Customs, dated the 30th June, 2017.

    In the said notification, for the entry in column (3) occurring against S. No. 453, the entry "20%" shall be substituted with "15%".

    S. No. 453 corresponds to HSN Code 8471 - Automatic data processing machines and units thereof.

    This notification shall come into force on the 15th day of April, 2024.',
    'pending'
) ON CONFLICT (notification_number) DO NOTHING;


-- Sample parsed item
INSERT INTO notification_items (
    notification_id,
    item_sequence,
    hsn_code_from,
    product_description,
    duty_type,
    old_rate,
    new_rate,
    rate_unit,
    hsn_confidence,
    rate_confidence,
    overall_confidence
) VALUES (
    (SELECT id FROM customs_notifications WHERE notification_number = '50/2024-Customs'),
    1,
    '8471',
    'Automatic data processing machines and units thereof (Laptops, Computers)',
    'BCD',
    20.00,
    15.00,
    'percent',
    0.95,
    0.98,
    0.96
) ON CONFLICT DO NOTHING;


-- ============================================================================
-- VIEWS: Useful queries for the application
-- ============================================================================

-- Active Notifications View
CREATE OR REPLACE VIEW active_notifications AS
SELECT
    n.id,
    n.notification_number,
    n.notification_type,
    n.title,
    n.issue_date,
    n.effective_from,
    n.effective_to,
    n.parsed_status,
    COUNT(ni.id) as items_count,
    AVG(ni.overall_confidence) as avg_confidence
FROM customs_notifications n
LEFT JOIN notification_items ni ON n.id = ni.notification_id
WHERE n.effective_to IS NULL OR n.effective_to >= CURRENT_DATE
GROUP BY n.id;

COMMENT ON VIEW active_notifications IS 'Currently active notifications with item counts';


-- Rate Changes View
CREATE OR REPLACE VIEW recent_rate_changes AS
SELECT
    n.notification_number,
    n.issue_date,
    n.effective_from,
    ni.hsn_code_from,
    ni.hsn_code_to,
    ni.product_description,
    ni.duty_type,
    ni.old_rate,
    ni.new_rate,
    (ni.new_rate - ni.old_rate) as rate_change,
    CASE
        WHEN ni.new_rate > ni.old_rate THEN 'increased'
        WHEN ni.new_rate < ni.old_rate THEN 'decreased'
        ELSE 'unchanged'
    END as change_direction,
    ni.overall_confidence
FROM customs_notifications n
JOIN notification_items ni ON n.id = ni.notification_id
WHERE n.issue_date >= CURRENT_DATE - INTERVAL '90 days'
ORDER BY n.issue_date DESC;

COMMENT ON VIEW recent_rate_changes IS 'Duty rate changes in the last 90 days';


-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Module 7: Notification Tracking schema created successfully!';
    RAISE NOTICE '📊 Tables: customs_notifications, notification_items, notification_conflicts, duty_rate_history, notification_alerts';
    RAISE NOTICE '📋 Views: active_notifications, recent_rate_changes';
    RAISE NOTICE '🔍 Sample notification inserted: 50/2024-Customs (BCD reduction for HSN 8471)';
END $$;
