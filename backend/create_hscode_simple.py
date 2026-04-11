"""
Create HSCODE.pkl file without pandas dependency
"""
import pickle

# Basic HS code mappings as a dictionary
hs_code_data = {
    'Integrated Circuits - Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.95},
    'Memory Chips - NAND FLASH': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    'Memory Chips - NOR FLASH': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    'Semiconductor Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.92},
    'Flash Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    'NAND Flash Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    'NOR Flash Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.94},
    'Integrated Circuit Memory': {'hs_code': '8542.32', 'chapter': '85', 'confidence': 0.93},
    'Electronic Integrated Circuits': {'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.90},
    'Processors and Controllers': {'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.91},
    'Microprocessors': {'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.92},
    'Microcontrollers': {'hs_code': '8542.31', 'chapter': '85', 'confidence': 0.92},
    'Memory Modules': {'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.88},
    'RAM Modules': {'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.88},
    'Computer Memory': {'hs_code': '8473.30', 'chapter': '84', 'confidence': 0.87},
    'Solid State Drives': {'hs_code': '8523.51', 'chapter': '85', 'confidence': 0.89},
    'Storage Devices': {'hs_code': '8523.51', 'chapter': '85', 'confidence': 0.86},
    'Electronic Components': {'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.85},
    'Semiconductor Devices': {'hs_code': '8541.10', 'chapter': '85', 'confidence': 0.87},
    'Electronic Chips': {'hs_code': '8542.39', 'chapter': '85', 'confidence': 0.86}
}

# Save to pickle file
output_path = 'IDP/static/HSCODE.pkl'
with open(output_path, 'wb') as f:
    pickle.dump(hs_code_data, f)

print(f"Created {output_path} with {len(hs_code_data)} HS code entries")
print("\nSample entries:")
for i, (desc, data) in enumerate(list(hs_code_data.items())[:5]):
    print(f"{i+1}. {desc}: {data['hs_code']} (confidence: {data['confidence']})")
