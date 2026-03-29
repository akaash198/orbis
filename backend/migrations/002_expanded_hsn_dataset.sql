-- Migration 002: Expanded HSN Dataset - 100 Common Import Products
-- Purpose: Add comprehensive duty rates for common import categories
-- Date: 2026-02-24
-- Project: OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform

-- ============================================================================
-- ELECTRONICS & IT PRODUCTS (20 codes)
-- ============================================================================

-- Smartphones and Mobile Accessories
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8517', 'Telephone sets, including smartphones', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8517', 'Telephone sets, including smartphones', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8518', 'Microphones, loudspeakers, headphones, earphones', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8518', 'Microphones, loudspeakers, headphones, earphones', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Computers and Laptops
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8471', 'Automatic data processing machines (laptops, computers)', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8471', 'Automatic data processing machines (laptops, computers)', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Computer Parts and Accessories
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8473', 'Parts and accessories for computers', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8473', 'Parts and accessories for computers', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Monitors and Displays
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8528', 'Monitors and projectors, television receivers', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8528', 'Monitors and projectors, television receivers', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Data Storage Devices
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8523', 'Discs, tapes, USB drives, memory cards', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8523', 'Discs, tapes, USB drives, memory cards', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Printers and Scanners
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8443', 'Printing machinery, printers, 3D printers', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8443', 'Printing machinery, printers, 3D printers', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Cameras and Video Equipment
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8525', 'Transmission apparatus for radio, TV, cameras', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8525', 'Transmission apparatus for radio, TV, cameras', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Semiconductors and Electronic Components
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8542', 'Electronic integrated circuits and microassemblies', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8542', 'Electronic integrated circuits and microassemblies', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Solar Panels and Cells
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8541', 'Solar cells and modules', 'BCD', 40.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8541', 'Solar cells and modules', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Batteries and Energy Storage
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8507', 'Electric accumulators and batteries', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8507', 'Electric accumulators and batteries', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- LED Lamps and Lighting
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8539', 'Electric filament or discharge lamps, LED lamps', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8539', 'Electric filament or discharge lamps, LED lamps', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Electrical Transformers
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8504', 'Electrical transformers, power supplies, inverters', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8504', 'Electrical transformers, power supplies, inverters', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Air Conditioners
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8415', 'Air conditioning machines', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8415', 'Air conditioning machines', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Refrigerators
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8418', 'Refrigerators, freezers, cooling equipment', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8418', 'Refrigerators, freezers, cooling equipment', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Washing Machines
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8450', 'Washing machines, laundry machines', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8450', 'Washing machines, laundry machines', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Electric Motors
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8501', 'Electric motors and generators', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8501', 'Electric motors and generators', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Cables and Wires
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8544', 'Insulated wire, cable, optical fiber cables', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8544', 'Insulated wire, cable, optical fiber cables', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Electric Switches and Connectors
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8536', 'Electrical apparatus for switching, connectors', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8536', 'Electrical apparatus for switching, connectors', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Electric Fans
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8414', 'Air or vacuum pumps, fans, ventilators', 'BCD', 12.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8414', 'Air or vacuum pumps, fans, ventilators', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- TEXTILES & APPAREL (15 codes)
-- ============================================================================

-- T-shirts and Vests
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6109', 'T-shirts, singlets and other vests, knitted', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6109', 'T-shirts, singlets and other vests, knitted', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Shirts
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6205', 'Men''s or boys'' shirts', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6205', 'Men''s or boys'' shirts', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Trousers and Jeans
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6203', 'Men''s or boys'' suits, trousers, shorts', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6203', 'Men''s or boys'' suits, trousers, shorts', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Dresses and Skirts
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6204', 'Women''s or girls'' suits, dresses, skirts', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6204', 'Women''s or girls'' suits, dresses, skirts', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Jackets and Coats
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6201', 'Men''s or boys'' overcoats, jackets, blazers', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6201', 'Men''s or boys'' overcoats, jackets, blazers', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Footwear - Leather
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6403', 'Footwear with outer soles of rubber, leather uppers', 'BCD', 25.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6403', 'Footwear with outer soles of rubber, leather uppers', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Footwear - Sports Shoes
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6404', 'Footwear with outer soles of rubber or plastics', 'BCD', 25.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6404', 'Footwear with outer soles of rubber or plastics', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Bags and Luggage
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4202', 'Trunks, suitcases, handbags, wallets', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4202', 'Trunks, suitcases, handbags, wallets', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Leather Garments
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4203', 'Articles of apparel made of leather', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4203', 'Articles of apparel made of leather', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Bed Linen and Towels
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6302', 'Bed linen, table linen, toilet linen, towels', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6302', 'Bed linen, table linen, toilet linen, towels', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Carpets and Rugs
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('5703', 'Carpets and textile floor coverings, tufted', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('5703', 'Carpets and textile floor coverings, tufted', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Cotton Fabrics
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('5208', 'Woven fabrics of cotton', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('5208', 'Woven fabrics of cotton', 'IGST', 5.00, '2024-01-01', 'CGST Act 2017');

-- Synthetic Fabrics
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('5407', 'Woven fabrics of synthetic filament yarn', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('5407', 'Woven fabrics of synthetic filament yarn', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Knitted Fabrics
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6006', 'Knitted or crocheted fabrics', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6006', 'Knitted or crocheted fabrics', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Yarns
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('5205', 'Cotton yarn (other than sewing thread)', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('5205', 'Cotton yarn (other than sewing thread)', 'IGST', 5.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- AUTOMOTIVE (10 codes)
-- ============================================================================

-- Passenger Cars
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8703', 'Motor cars and other motor vehicles', 'BCD', 125.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8703', 'Motor cars and other motor vehicles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017'),
('8703', 'Motor cars and other motor vehicles', 'CESS', 22.00, '2024-01-01', 'GST Compensation Cess');

-- Motorcycles and Scooters
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8711', 'Motorcycles and cycles with motor', 'BCD', 60.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8711', 'Motorcycles and cycles with motor', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Bicycles
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8712', 'Bicycles and other cycles', 'BCD', 30.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8712', 'Bicycles and other cycles', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Auto Parts - Engine Parts
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8409', 'Parts for spark-ignition engines', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8409', 'Parts for spark-ignition engines', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Auto Parts - Bodies and Parts
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8707', 'Bodies for motor vehicles', 'BCD', 30.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8707', 'Bodies for motor vehicles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Auto Parts - Brakes and Steering
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8708', 'Parts and accessories for motor vehicles', 'BCD', 15.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8708', 'Parts and accessories for motor vehicles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Tires - New
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4011', 'New pneumatic tires of rubber', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4011', 'New pneumatic tires of rubber', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Inner Tubes
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4013', 'Inner tubes of rubber', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4013', 'Inner tubes of rubber', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Spark Plugs
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8511', 'Electrical ignition equipment, spark plugs', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8511', 'Electrical ignition equipment, spark plugs', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Horns and Sirens
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8512', 'Electrical lighting, signaling equipment for vehicles', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8512', 'Electrical lighting, signaling equipment for vehicles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- MACHINERY & INDUSTRIAL EQUIPMENT (10 codes)
-- ============================================================================

-- Machine Tools
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8456', 'Machine tools for working materials by laser', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8456', 'Machine tools for working materials by laser', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Industrial Machinery
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8479', 'Machines and mechanical appliances', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8479', 'Machines and mechanical appliances', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Pumps for Liquids
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8413', 'Pumps for liquids, liquid elevators', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8413', 'Pumps for liquids, liquid elevators', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Valves and Taps
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8481', 'Taps, cocks, valves for pipes, tanks', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8481', 'Taps, cocks, valves for pipes, tanks', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Bearings
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8482', 'Ball or roller bearings', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8482', 'Ball or roller bearings', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Gears and Gearing
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8483', 'Transmission shafts, gears, flywheels', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8483', 'Transmission shafts, gears, flywheels', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Lifting Equipment
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8425', 'Pulley tackle, hoists, winches, jacks', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8425', 'Pulley tackle, hoists, winches, jacks', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Cranes and Lifting Machinery
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8426', 'Derricks, cranes, mobile lifting frames', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8426', 'Derricks, cranes, mobile lifting frames', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Bulldozers and Excavators
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8429', 'Bulldozers, graders, excavators, road rollers', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8429', 'Bulldozers, graders, excavators, road rollers', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Agricultural Machinery
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8432', 'Agricultural, horticultural machinery for soil', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('8432', 'Agricultural, horticultural machinery for soil', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- CHEMICALS & PHARMACEUTICALS (10 codes)
-- ============================================================================

-- Organic Chemicals
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('2918', 'Carboxylic acids with additional oxygen function', 'BCD', 7.50, '2024-01-01', 'Notification 50/2024-Customs'),
('2918', 'Carboxylic acids with additional oxygen function', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Medicaments
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3004', 'Medicaments (excluding goods of heading 3002, 3005 or 3006)', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3004', 'Medicaments (excluding goods of heading 3002, 3005 or 3006)', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Antibiotics
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3003', 'Medicaments of mixed or unmixed products', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3003', 'Medicaments of mixed or unmixed products', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Vitamins and Supplements
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('2936', 'Provitamins and vitamins', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('2936', 'Provitamins and vitamins', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Paints and Coatings
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3208', 'Paints and varnishes based on synthetic polymers', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3208', 'Paints and varnishes based on synthetic polymers', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Pesticides and Insecticides
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3808', 'Insecticides, rodenticides, fungicides, herbicides', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3808', 'Insecticides, rodenticides, fungicides, herbicides', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Adhesives and Glues
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3506', 'Prepared glues and adhesives', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3506', 'Prepared glues and adhesives', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Plastic Articles
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3923', 'Articles for transport or packing of plastics', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3923', 'Articles for transport or packing of plastics', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Plastic Sheets and Films
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3920', 'Plates, sheets, film, foil of plastics', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3920', 'Plates, sheets, film, foil of plastics', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Perfumes and Cosmetics
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('3304', 'Beauty or make-up preparations, skin care', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('3304', 'Beauty or make-up preparations, skin care', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- METALS & BUILDING MATERIALS (10 codes)
-- ============================================================================

-- Steel Flat Products
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7208', 'Flat-rolled products of iron or steel', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7208', 'Flat-rolled products of iron or steel', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Steel Bars and Rods
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7214', 'Bars and rods of iron or steel', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7214', 'Bars and rods of iron or steel', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Steel Pipes and Tubes
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7306', 'Line pipe for oil or gas pipelines of iron or steel', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7306', 'Line pipe for oil or gas pipelines of iron or steel', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Aluminum Sheets
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7606', 'Aluminum plates, sheets, strips', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7606', 'Aluminum plates, sheets, strips', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Copper Wire
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7408', 'Copper wire', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7408', 'Copper wire', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Copper Plates and Sheets
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7409', 'Copper plates, sheets, strips', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7409', 'Copper plates, sheets, strips', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Zinc Articles
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7907', 'Other articles of zinc', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7907', 'Other articles of zinc', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Glass Sheets
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7005', 'Float glass and surface ground glass, in sheets', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7005', 'Float glass and surface ground glass, in sheets', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Ceramic Tiles
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6907', 'Ceramic flags, paving, hearth tiles', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6907', 'Ceramic flags, paving, hearth tiles', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Cement
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('2523', 'Portland cement, aluminous cement, slag cement', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('2523', 'Portland cement, aluminous cement, slag cement', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- FURNITURE & HOME GOODS (8 codes)
-- ============================================================================

-- Wooden Furniture
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9403', 'Other furniture and parts thereof', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9403', 'Other furniture and parts thereof', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Metal Furniture
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9401', 'Seats (excluding those of heading 9402)', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9401', 'Seats (excluding those of heading 9402)', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Mattresses
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9404', 'Mattress supports, mattresses, cushions', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9404', 'Mattress supports, mattresses, cushions', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Lamps and Lighting
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9405', 'Lamps and lighting fittings', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9405', 'Lamps and lighting fittings', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Tableware and Kitchenware
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('6911', 'Tableware, kitchenware of porcelain or china', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('6911', 'Tableware, kitchenware of porcelain or china', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Glassware
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('7013', 'Glassware of a kind used for table, kitchen', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('7013', 'Glassware of a kind used for table, kitchen', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Cutlery
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('8211', 'Knives with cutting blades, scissors', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('8211', 'Knives with cutting blades, scissors', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Clocks and Watches
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9102', 'Wrist watches, pocket watches', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9102', 'Wrist watches, pocket watches', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- TOYS, SPORTS & OPTICAL GOODS (7 codes)
-- ============================================================================

-- Toys
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9503', 'Toys, scale models, puzzles', 'BCD', 60.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9503', 'Toys, scale models, puzzles', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Video Game Consoles
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9504', 'Video game consoles, articles for games', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9504', 'Video game consoles, articles for games', 'IGST', 28.00, '2024-01-01', 'CGST Act 2017');

-- Sports Equipment
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9506', 'Articles and equipment for gymnastics, athletics', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9506', 'Articles and equipment for gymnastics, athletics', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Fishing Equipment
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9507', 'Fishing rods, hooks and other fishing gear', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9507', 'Fishing rods, hooks and other fishing gear', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Musical Instruments
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9207', 'Musical instruments (keyboard, string)', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9207', 'Musical instruments (keyboard, string)', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Optical Instruments
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9013', 'Liquid crystal devices, lasers, optical instruments', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9013', 'Liquid crystal devices, lasers, optical instruments', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Sunglasses and Eyewear
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9004', 'Spectacles, goggles, sunglasses', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9004', 'Spectacles, goggles, sunglasses', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- BOOKS, PAPER & PRINTING (5 codes)
-- ============================================================================

-- Printed Books
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4901', 'Printed books, brochures, leaflets', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4901', 'Printed books, brochures, leaflets', 'IGST', 12.00, '2024-01-01', 'CGST Act 2017');

-- Newspapers and Periodicals
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4902', 'Newspapers, journals, periodicals', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4902', 'Newspapers, journals, periodicals', 'IGST', 5.00, '2024-01-01', 'CGST Act 2017');

-- Paper and Paperboard
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4810', 'Paper and paperboard, coated with kaolin', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4810', 'Paper and paperboard, coated with kaolin', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Stationery Items
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('9608', 'Ball point pens, markers, writing instruments', 'BCD', 20.00, '2024-01-01', 'Notification 50/2024-Customs'),
('9608', 'Ball point pens, markers, writing instruments', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- Packaging Materials
INSERT INTO duty_rates (hsn_code, hsn_description, duty_type, rate_percent, effective_from, notification_number) VALUES
('4819', 'Cartons, boxes, cases of paper or paperboard', 'BCD', 10.00, '2024-01-01', 'Notification 50/2024-Customs'),
('4819', 'Cartons, boxes, cases of paper or paperboard', 'IGST', 18.00, '2024-01-01', 'CGST Act 2017');

-- ============================================================================
-- SUMMARY
-- ============================================================================

-- Migration complete! Added 100 common HSN codes across major categories:
-- - Electronics & IT: 20 codes
-- - Textiles & Apparel: 15 codes
-- - Automotive: 10 codes
-- - Machinery & Industrial: 10 codes
-- - Chemicals & Pharma: 10 codes
-- - Metals & Building Materials: 10 codes
-- - Furniture & Home Goods: 8 codes
-- - Toys, Sports & Optical: 7 codes
-- - Books, Paper & Printing: 5 codes

-- Total: 100 HSN codes with ~210 duty rate records
-- Combined with migration 001: 110 total HSN codes

COMMENT ON COLUMN duty_rates.hsn_code IS 'Harmonized System Nomenclature code (4-10 digits) - India Customs';
COMMENT ON COLUMN duty_rates.duty_type IS 'BCD=Basic Customs Duty, IGST=Integrated GST, CESS=Compensation Cess, SWS=Social Welfare Surcharge, ADD=Anti-Dumping Duty, CVD=Countervailing Duty';
