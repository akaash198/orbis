-- Add Memory Chip HSN Code to duty_rates table
-- HSN 8542.32: Electronic integrated circuits - Memories

-- Delete existing code if any (to avoid duplicates)
DELETE FROM duty_rates WHERE hsn_code = '8542.32.00';

-- Insert Memory Chip HSN code (normalized: each duty type as separate row)
INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, effective_to, port_code, country_of_origin, legal_priority)
VALUES
    -- 8542.32.00: Electronic integrated circuits - Memories (NAND, NOR Flash, RAM, etc.)
    ('8542.32.00', 'BCD', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.32.00', 'IGST', 18.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.32.00', 'CESS', 0.00, '2024-01-01', NULL, NULL, NULL, 1),
    ('8542.32.00', 'SWS', 10.00, '2024-01-01', NULL, NULL, NULL, 1);

-- Verify insertion
SELECT 'Added HSN 8542.32.00 (Memory Chips) with ' || COUNT(*) || ' duty rate entries' as status
FROM duty_rates
WHERE hsn_code = '8542.32.00';
