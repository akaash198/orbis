"""
Create HSCODE.pkl file in the correct format for DataFrame conversion
"""
import pickle

# Create data in list of dictionaries format - this converts properly to DataFrame
hs_code_data = [
    {'description': 'Integrated Circuits - Memory 128M NOR FLASH PLASTIC', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.95},
    {'description': 'Integrated Circuits - Memory 2G NAND FLASH PLASTIC', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    {'description': 'Integrated Circuits - Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.95},
    {'description': 'Memory Chips - NAND FLASH', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    {'description': 'Memory Chips - NOR FLASH', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    {'description': 'Semiconductor Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.92},
    {'description': 'Flash Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    {'description': 'NAND Flash Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    {'description': 'NOR Flash Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    {'description': 'Integrated Circuit Memory', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    {'description': 'Electronic Integrated Circuits', 'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.90},
    {'description': 'Processors and Controllers', 'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.91},
    {'description': 'Microprocessors', 'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.92},
    {'description': 'Microcontrollers', 'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.92},
    {'description': 'Memory Modules', 'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.88},
    {'description': 'RAM Modules', 'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.88},
    {'description': 'Computer Memory', 'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.87},
    {'description': 'Solid State Drives', 'hs_code': '8523.51', 'chapter': '85', 'confidence': 0.89},
    {'description': 'Storage Devices', 'hs_code': '8523.51', 'chapter': '85', 'confidence': 0.86},
    {'description': 'Electronic Components', 'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.85},
    {'description': 'Semiconductor Devices', 'hs_code': '8541.10', 'chapter': '85', 'confidence': 0.87},
    {'description': 'Electronic Chips', 'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.86},
    {'description': 'PLASTIC', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.70},
    {'description': '128M', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.65},
    {'description': '2G', 'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.65},
]

# Save as list of dictionaries - this will convert properly to DataFrame
output_path = 'IDP/static/HSCODE.pkl'
with open(output_path, 'wb') as f:
    pickle.dump(hs_code_data, f)

print(f"Created {output_path} with {len(hs_code_data)} HS code entries")
print("\nSample entries:")
for i, entry in enumerate(hs_code_data[:5]):
    print(f"{i+1}. {entry['description']}: {entry['hs_code']} (confidence: {entry['confidence']})")
print("\n✓ File created in DataFrame-compatible format")
