-- Add Electronic Component HSN Codes to duty_rates table
-- Chapter 85: Electrical machinery and equipment
--
-- Schema: duty_rates table has normalized structure:
-- (hsn_code, duty_type, rate_percent, effective_from, effective_to, port_code, country_of_origin, legal_priority)

-- Delete existing electronic codes if any (to avoid duplicates)
DELETE FROM duty_rates WHERE hsn_code IN (
    '8541.10.00', '8541.21.00', '8541.41.00', '8541.49.00',
    '8542.31.00', '8542.39.00',
    '8532.22.00', '8533.21.00', '8504.50.00', '8536.69.00'
);

-- Insert electronic component HSN codes (normalized: each duty type as separate row)
INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, effective_to, port_code, country_of_origin, legal_priority)
VALUES
    -- 8541.10.00: Diodes
    ('8541.10.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.10.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.10.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.10.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8541.21.00: Transistors
    ('8541.21.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.21.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.21.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.21.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8541.41.00: LED / Optocouplers
    ('8541.41.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.41.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.41.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.41.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8541.49.00: Other semiconductor devices
    ('8541.49.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.49.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.49.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8541.49.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8542.31.00: Processors and controllers
    ('8542.31.00', 'BCD', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.31.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.31.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.31.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8542.39.00: Other integrated circuits
    ('8542.39.00', 'BCD', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.39.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.39.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.39.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8532.22.00: Capacitors
    ('8532.22.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8532.22.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8532.22.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8532.22.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8533.21.00: Resistors
    ('8533.21.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8533.21.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8533.21.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8533.21.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8504.50.00: Inductors
    ('8504.50.00', 'BCD', 7.50, '2024-01-01', NULL, NULL, NULL, 1),
    ('8504.50.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8504.50.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8504.50.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1),

    -- 8536.69.00: Connectors
    ('8536.69.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8536.69.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8536.69.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8536.69.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1);

-- Verify insertion
SELECT 'Added ' || COUNT(DISTINCT hsn_code) || ' HSN codes with ' || COUNT(*) || ' duty rate entries' as status
FROM duty_rates
WHERE hsn_code IN (
    '8541.10.00', '8541.21.00', '8541.41.00', '8541.49.00',
    '8542.31.00', '8542.39.00',
    '8532.22.00', '8533.21.00', '8504.50.00', '8536.69.00'
);
