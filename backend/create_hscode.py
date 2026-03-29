"""
Create HSCODE.pkl file with basic HS code mappings for electronics
"""
import pickle
import pandas as pd

# Basic HS code mappings for common electronics items
hs_code_data = {
    'description': [
        'Integrated Circuits - Memory',
        'Memory Chips - NAND FLASH',
        'Memory Chips - NOR FLASH',
        'Semiconductor Memory',
        'Flash Memory',
        'NAND Flash Memory',
        'NOR Flash Memory',
        'Integrated Circuit Memory',
        'Electronic Integrated Circuits',
        'Processors and Controllers',
        'Microprocessors',
        'Microcontrollers',
        'Memory Modules',
        'RAM Modules',
        'Computer Memory',
        'Solid State Drives',
        'Storage Devices',
        'Electronic Components',
        'Semiconductor Devices',
        'Electronic Chips'
    ],
    'hs_code': [
        '8542.32',  # Electronic integrated circuits - Memories
        '8542.32',  # NAND Flash
        '8542.32',  # NOR Flash
        '8542.32',  # Semiconductor Memory
        '8542.32',  # Flash Memory
        '8542.32',  # NAND Flash Memory
        '8542.32',  # NOR Flash Memory
        '8542.32',  # IC Memory
        '8542.39',  # Other Electronic ICs
        '8542.31',  # Processors
        '8542.31',  # Microprocessors
        '8542.31',  # Microcontrollers
        '8473.30',  # Memory Modules
        '8473.30',  # RAM Modules
        '8473.30',  # Computer Memory
        '8523.51',  # Solid State Drives
        '8523.51',  # Storage Devices
        '8542.39',  # Electronic Components
        '8541.10',  # Semiconductor Devices
        '8542.39'   # Electronic Chips
    ],
    'chapter': [
        '85',  # Electrical machinery and equipment
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '85',
        '84',  # Nuclear reactors, boilers, machinery
        '84',
        '84',
        '85',
        '85',
        '85',
        '85',
        '85'
    ],
    'confidence': [
        0.95,
        0.93,
        0.93,
        0.92,
        0.94,
        0.94,
        0.94,
        0.93,
        0.90,
        0.91,
        0.92,
        0.92,
        0.88,
        0.88,
        0.87,
        0.89,
        0.86,
        0.85,
        0.87,
        0.86
    ]
}

# Create DataFrame
df = pd.DataFrame(hs_code_data)

# Save to pickle file
output_path = 'IDP/static/HSCODE.pkl'
with open(output_path, 'wb') as f:
    pickle.dump(df, f)

print(f"Created {output_path} with {len(df)} HS code entries")
print("\nSample entries:")
print(df.head(10))
