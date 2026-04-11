-- Migration: M04 Duty Computation Engine
-- Purpose: Exchange rates, FTA notifications, ADD/CVD trade remedies, full computation audit trail
-- SOP: DUTY-001 to DUTY-008
-- Date: 2026-03-23
-- Project: OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform

-- ─────────────────────────────────────────────────────────────────────────────
-- Table 1: Exchange Rate Cache  (SOP Step 2 — AV = CIF × Exchange Rate)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS m04_exchange_rates (
    id              SERIAL PRIMARY KEY,
    currency_code   VARCHAR(3)      NOT NULL,   -- ISO 4217 (USD, EUR, GBP, …)
    rate_inr        DECIMAL(12, 4)  NOT NULL,   -- 1 unit of currency_code in INR
    source          VARCHAR(50)     NOT NULL DEFAULT 'RBI',  -- RBI | CBIC | MANUAL
    fetched_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_for_date  DATE            NOT NULL DEFAULT CURRENT_DATE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    raw_response    JSONB,                      -- full API response for audit
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_m04_exrate_currency_date
    ON m04_exchange_rates(currency_code, valid_for_date)
    WHERE is_active = TRUE;

CREATE INDEX idx_m04_exrate_fetched ON m04_exchange_rates(fetched_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Table 2: FTA / Trade Agreement Registry  (SOP Step 8)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS m04_fta_agreements (
    id                  SERIAL PRIMARY KEY,
    agreement_code      VARCHAR(30)  NOT NULL UNIQUE,  -- ASEAN-FTA, SAFTA, CECA-SL, ...
    agreement_name      TEXT         NOT NULL,
    partner_countries   VARCHAR(3)[] NOT NULL,          -- ISO 3-letter codes
    effective_from      DATE         NOT NULL,
    effective_to        DATE,                            -- NULL = still active
    notification_ref    VARCHAR(100),
    source_url          TEXT,
    full_text_path      TEXT,                            -- local PDF path for LLM parsing
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- FTA Preferential Tariff Lines  (HSN-level BCD concession per agreement)
CREATE TABLE IF NOT EXISTS m04_fta_tariff_rates (
    id                  SERIAL PRIMARY KEY,
    agreement_id        INTEGER NOT NULL REFERENCES m04_fta_agreements(id),
    hsn_code            VARCHAR(10) NOT NULL,
    preferential_bcd    DECIMAL(5,2) NOT NULL,   -- reduced BCD rate under FTA
    staging_category    VARCHAR(10),              -- EL, SL, NT, X, etc.
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    roo_criteria        TEXT,                     -- Rules of Origin criteria text
    roo_threshold_pct   DECIMAL(5,2),             -- e.g., 35% local value content
    notes               TEXT,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_m04_fta_tariff_hsn ON m04_fta_tariff_rates(hsn_code);
CREATE INDEX idx_m04_fta_tariff_agreement ON m04_fta_tariff_rates(agreement_id);

-- RoO Eligibility Check Log
CREATE TABLE IF NOT EXISTS m04_roo_checks (
    id                  SERIAL PRIMARY KEY,
    check_uuid          UUID NOT NULL DEFAULT gen_random_uuid(),
    hsn_code            VARCHAR(10) NOT NULL,
    country_of_origin   VARCHAR(3)  NOT NULL,
    agreement_code      VARCHAR(30),
    is_eligible         BOOLEAN,
    confidence          DECIMAL(4,3),             -- 0-1 from LLM
    roo_criteria_applied TEXT,
    llm_reasoning       TEXT,                     -- GPT-4o-mini explanation
    checked_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_m04_roo_hsn_country ON m04_roo_checks(hsn_code, country_of_origin);


-- ─────────────────────────────────────────────────────────────────────────────
-- Table 3: Trade Remedy Notifications  (SOP Steps 6–7  — ADD / CVD / SGD)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS m04_trade_remedy_notifications (
    id                  SERIAL PRIMARY KEY,
    notification_number VARCHAR(100) NOT NULL,
    remedy_type         VARCHAR(10)  NOT NULL CHECK (remedy_type IN ('ADD','CVD','SGD','PVD')),
    hsn_code            VARCHAR(10)  NOT NULL,
    country_of_origin   VARCHAR(3),              -- NULL = all countries
    exporter_name       TEXT,                    -- specific exporter, if any
    rate_type           VARCHAR(20)  NOT NULL DEFAULT 'AD_VALOREM',  -- AD_VALOREM | SPECIFIC
    rate_value          DECIMAL(10,4),           -- % for ad valorem, or INR/unit for specific
    rate_currency       VARCHAR(3)   DEFAULT 'INR',
    unit                VARCHAR(20),             -- for specific duties (KG, MT, etc.)
    effective_from      DATE         NOT NULL,
    effective_to        DATE,                    -- NULL = active
    issuing_authority   VARCHAR(100) DEFAULT 'DGTR',
    dgtr_case_number    VARCHAR(50),
    gazette_ref         TEXT,
    source_pdf_path     TEXT,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    parsed_by_llm       BOOLEAN NOT NULL DEFAULT FALSE,
    llm_parse_date      TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_m04_remedy_hsn ON m04_trade_remedy_notifications(hsn_code, is_active);
CREATE INDEX idx_m04_remedy_country ON m04_trade_remedy_notifications(country_of_origin);
CREATE INDEX idx_m04_remedy_type ON m04_trade_remedy_notifications(remedy_type);


-- ─────────────────────────────────────────────────────────────────────────────
-- Table 4: M04 Full Duty Computation Audit Trail
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS m04_duty_computations (
    id                      SERIAL PRIMARY KEY,
    computation_uuid        UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    user_id                 INTEGER,
    document_id             INTEGER,

    -- ── SOP Step 1: CIF Inputs ──────────────────────────────────────────────
    fob_cost                DECIMAL(14,4),       -- original currency
    freight                 DECIMAL(14,4),
    insurance               DECIMAL(14,4),
    cif_foreign             DECIMAL(14,4),       -- = fob + freight + insurance
    input_currency          VARCHAR(3) NOT NULL DEFAULT 'USD',
    hsn_code                VARCHAR(10) NOT NULL,
    country_of_origin       VARCHAR(3),
    port_code               VARCHAR(10),
    quantity                DECIMAL(12,3),
    unit                    VARCHAR(20),

    -- ── SOP Step 2: Exchange Rate & AV ─────────────────────────────────────
    exchange_rate           DECIMAL(12,4),       -- INR per 1 unit of input_currency
    exchange_rate_source    VARCHAR(50),
    exchange_rate_date      DATE,
    assessable_value_inr    DECIMAL(14,2),       -- AV = CIF_foreign × exchange_rate

    -- ── SOP Step 3-4: BCD & SWS ─────────────────────────────────────────────
    bcd_rate                DECIMAL(5,2),
    bcd_amount              DECIMAL(14,2),
    sws_rate                DECIMAL(5,2) DEFAULT 10.00,
    sws_amount              DECIMAL(14,2),

    -- ── SOP Step 5: IGST ────────────────────────────────────────────────────
    igst_base               DECIMAL(14,2),       -- AV + BCD + SWS
    igst_rate               DECIMAL(5,2),
    igst_amount             DECIMAL(14,2),

    -- ── SOP Step 6: ADD ─────────────────────────────────────────────────────
    add_rate                DECIMAL(10,4),
    add_amount              DECIMAL(14,2),
    add_notification_ref    VARCHAR(100),

    -- ── SOP Step 7: CVD / SGD ───────────────────────────────────────────────
    cvd_rate                DECIMAL(5,2),
    cvd_amount              DECIMAL(14,2),
    sgd_rate                DECIMAL(5,2),
    sgd_amount              DECIMAL(14,2),

    -- ── SOP Step 8: FTA ─────────────────────────────────────────────────────
    fta_applicable          BOOLEAN DEFAULT FALSE,
    fta_agreement_code      VARCHAR(30),
    fta_preferential_bcd    DECIMAL(5,2),
    fta_roo_eligible        BOOLEAN,
    fta_exemption_amount    DECIMAL(14,2),       -- duty saved via FTA

    -- ── Totals ─────────────────────────────────────────────────────────────
    total_duty_inr          DECIMAL(14,2),
    total_payable_inr       DECIMAL(14,2),       -- AV + total_duty

    -- ── Audit ────────────────────────────────────────────────────────────
    sop_steps_json          JSONB,               -- step-by-step breakdown
    formula_text            TEXT,
    anomaly_flags           JSONB,               -- ML freight anomaly, etc.
    calculation_time_ms     INTEGER,
    computed_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- ── Review ───────────────────────────────────────────────────────────
    is_validated            BOOLEAN DEFAULT FALSE,
    validated_by            VARCHAR(100),
    validated_at            TIMESTAMP
);

CREATE INDEX idx_m04_comp_user      ON m04_duty_computations(user_id, computed_at DESC);
CREATE INDEX idx_m04_comp_document  ON m04_duty_computations(document_id);
CREATE INDEX idx_m04_comp_hsn       ON m04_duty_computations(hsn_code);
CREATE INDEX idx_m04_comp_uuid      ON m04_duty_computations(computation_uuid);


-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data: FTA agreements India is party to
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO m04_fta_agreements (agreement_code, agreement_name, partner_countries, effective_from, notification_ref) VALUES
('ASEAN-FTA',   'India-ASEAN Free Trade Agreement (AIFTA)',  ARRAY['IDN','MYS','PHL','SGP','THA','VNM','BRN','KHM','LAO','MMR'], '2010-01-01', 'Notification 46/2011-Customs'),
('SAFTA',       'South Asian Free Trade Area',               ARRAY['BGD','BTN','MDV','NPL','PAK','LKA'],                          '2006-07-01', 'Notification 80/2006-Customs'),
('CECA-SG',     'India-Singapore Comprehensive Economic Cooperation Agreement', ARRAY['SGP'],                                     '2005-08-01', 'Notification 24/2005-Customs'),
('CEPA-KR',     'India-Korea Comprehensive Economic Partnership Agreement',     ARRAY['KOR'],                                     '2010-01-01', 'Notification 152/2009-Customs'),
('CEPA-JP',     'India-Japan Comprehensive Economic Partnership Agreement',     ARRAY['JPN'],                                     '2011-08-01', 'Notification 69/2011-Customs'),
('FTA-SL',      'India-Sri Lanka Free Trade Agreement',      ARRAY['LKA'],                                                       '2000-03-01', 'Notification 26/2000-Customs'),
('CECA-UAE',    'India-UAE Comprehensive Economic Partnership Agreement',       ARRAY['ARE'],                                     '2022-05-01', 'Notification 34/2022-Customs'),
('ECTA-AUS',    'India-Australia Economic Cooperation and Trade Agreement',     ARRAY['AUS'],                                     '2022-12-29', 'Notification 57/2022-Customs');


-- ─────────────────────────────────────────────────────────────────────────────
-- Seed data: Active ADD notifications (sample — China, HSN 85044030)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO m04_trade_remedy_notifications
    (notification_number, remedy_type, hsn_code, country_of_origin, rate_type,
     rate_value, effective_from, issuing_authority, dgtr_case_number, is_active, parsed_by_llm)
VALUES
('12/2023-Customs(ADD)', 'ADD', '85044030', 'CHN', 'AD_VALOREM',  12.00, '2023-03-01', 'DGTR', 'DGTR/ADD/OI-12/2022', TRUE, FALSE),
('34/2022-Customs(ADD)', 'ADD', '7208',     'CHN', 'AD_VALOREM',   8.50, '2022-06-01', 'DGTR', 'DGTR/ADD/OI-34/2021', TRUE, FALSE),
('18/2024-Customs(CVD)', 'CVD', '8517',     'CHN', 'AD_VALOREM',   5.00, '2024-01-15', 'DGTR', 'DGTR/CVD/OI-18/2023', TRUE, FALSE);


COMMENT ON TABLE m04_duty_computations       IS 'Full M04 audit trail — every duty computation, all SOP steps (OrbisPorté)';
COMMENT ON TABLE m04_exchange_rates          IS 'Live exchange rate cache from RBI / CBIC APIs (M04)';
COMMENT ON TABLE m04_fta_agreements          IS 'FTA agreements India is party to, with partner country list (M04)';
COMMENT ON TABLE m04_fta_tariff_rates        IS 'Preferential BCD rates per HSN per FTA agreement (M04)';
COMMENT ON TABLE m04_trade_remedy_notifications IS 'ADD / CVD / SGD active notifications sourced from DGTR PDFs (M04)';
