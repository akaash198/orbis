"""Add duty rates for sample invoice HSN codes"""
from sqlalchemy import create_engine, text

engine = create_engine('postgresql://postgres:admin@localhost:5432/orbisporte_db')

with engine.connect() as conn:
    # Insert duty rates for HSN 8528720000 (LED Display Panels)
    # BCD: 10%, IGST: 18%
    conn.execute(text("""
        INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, created_by)
        VALUES
            ('8528720000', 'BCD', 10.00, '2024-01-01', 1),
            ('8528720000', 'IGST', 18.00, '2024-01-01', 1)
        ON CONFLICT DO NOTHING
    """))

    # Insert duty rates for HSN 8471600000 (Wireless Keyboards)
    # BCD: 10%, IGST: 18%
    conn.execute(text("""
        INSERT INTO duty_rates (hsn_code, duty_type, rate_percent, effective_from, created_by)
        VALUES
            ('8471600000', 'BCD', 10.00, '2024-01-01', 1),
            ('8471600000', 'IGST', 18.00, '2024-01-01', 1)
        ON CONFLICT DO NOTHING
    """))

    conn.commit()
    print("SUCCESS: Duty rates inserted successfully!")

    # Verify
    result = conn.execute(text("""
        SELECT hsn_code, duty_type, rate_percent
        FROM duty_rates
        WHERE hsn_code IN ('8528720000', '8471600000')
        ORDER BY hsn_code, duty_type
    """))

    print("\nDuty Rates in Database:")
    for row in result:
        print(f"  HSN: {row[0]}, {row[1]}: {row[2]}%")
