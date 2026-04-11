-- Check if electronic component HSN codes exist in duty_rates table
SELECT hsn_code, description, bcd_rate, igst_rate
FROM duty_rates
WHERE hsn_code LIKE '8541%' OR hsn_code LIKE '8542%'
ORDER BY hsn_code;

-- Count total HSN codes
SELECT COUNT(*) as total_hsn_codes FROM duty_rates;
