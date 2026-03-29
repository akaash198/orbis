-- Add Cable HSN Codes to duty_rates table
-- HSN 8544: Insulated wire and cable

-- Delete existing codes if any (to avoid duplicates)
DELETE FROM duty_rates WHERE hsn_code IN ('8544.49.00', '8544.30.00');

-- Insert Cable HSN codes (normalized: each duty type as separate row)
INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, effective_to, port_code, country_of_origin, legal_priority)
VALUES
    -- 8544.49.00: Insulated wire and cable (general purpose)
    ('8544.49.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.49.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.49.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.49.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8544.30.00: Wiring sets for vehicles/aircraft
    ('8544.30.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.30.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.30.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8544.30.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1);

-- Verify insertion
SELECT 'Added ' || COUNT(DISTINCT hsn_code) || ' cable HSN codes with ' || COUNT(*) || ' duty rate entries' as status
FROM duty_rates
WHERE hsn_code IN ('8544.49.00', '8544.30.00');
