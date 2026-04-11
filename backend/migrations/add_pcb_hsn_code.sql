-- Add Printed Circuit Board (PCB) HSN Code to duty_rates table
-- HSN 8534: Printed circuits

-- Delete existing code if any (to avoid duplicates)
DELETE FROM duty_rates WHERE hsn_code = '8534.00.00';

-- Insert PCB HSN code (normalized: each duty type as separate row)
INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, effective_to, port_code, country_of_origin, legal_priority)
VALUES
    -- 8534.00.00: Printed circuits (PCB)
    ('8534.00.00', 'BCD', 10.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8534.00.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8534.00.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8534.00.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1);

-- Verify insertion
SELECT 'Added HSN 8534.00.00 (Printed Circuits) with ' || COUNT(*) || ' duty rate entries' as status
FROM duty_rates
WHERE hsn_code = '8534.00.00';
