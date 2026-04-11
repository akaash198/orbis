# Module 3: Bill of Entry (BoE) Auto-fill & Editor ✅

## **Implementation Complete!**

Module 3 successfully implemented based on the OrbisPorté design specification.

---

## **Overview**

This module automatically generates **Bill of Entry (BoE)** documents from processed invoices with calculated customs duties. It implements the complete workflow from invoice extraction to ICEGATE-ready filing format.

### **Key Features**

✅ **Auto-fill BoE** from extracted invoice data
✅ **Port-specific field mapping** (Mumbai, Chennai, Kolkata, Bangalore)
✅ **Automatic duty aggregation** from line-item calculations
✅ **Risk-based validation** (auto-approve low-risk, flag high-risk)
✅ **Business rule validation** (required fields, format checks, cross-field validation)
✅ **Version control** with change tracking
✅ **ICEGATE export** in port-specific formats

---

## **Architecture**

### **Database Schema**

Created in: `migrations/003_bill_of_entry_tables.sql`

**Tables:**
1. `bills_of_entry` - BoE header information
2. `boe_line_items` - Individual line items with duty breakdown
3. `boe_versions` - Version history snapshots
4. `boe_validation_rules` - Configurable validation rules
5. `port_configurations` - Port-specific settings

### **Service Layer**

Created in: `Orbisporte/domain/services/boe_autofill.py`

**Class:** `BoEAutoFillService`

**Key Methods:**
- `create_boe_from_invoice()` - Main entry point
- `validate_boe()` - Run validation rules
- `export_boe_for_port()` - Export for ICEGATE filing
- `_calculate_risk_score()` - Risk assessment (0-100)

### **Configuration**

Created in: `Orbisporte/config/port_field_mappings.py`

**Port Mappings:**
- `INMAA1` - Mumbai (Nhava Sheva)
- `INMAA4` - Chennai
- `INCCU1` - Kolkata
- `INBLR4` - Bangalore Air Cargo

### **API Endpoints**

Added to: `Orbisporte/interfaces/api/routes.py`

**Endpoints:**
```
POST   /react/boe/create-from-invoice   - Create BoE from invoice
GET    /react/boe/{boe_id}               - Get BoE details
POST   /react/boe/{boe_id}/validate      - Validate BoE
GET    /react/boe/{boe_id}/export        - Export for ICEGATE
GET    /react/boe/list                   - List all BoEs
```

---

## **Setup Instructions**

### **Step 1: Run Database Migration**

```bash
cd backend
psql -U your_username -d orbisporte_db -f migrations/003_bill_of_entry_tables.sql
```

This creates:
- 5 new tables
- Indexes for performance
- Default port configurations
- Basic validation rules

### **Step 2: Verify Tables Created**

```sql
\dt bills_of_entry
\dt boe_line_items
\dt boe_versions
\dt boe_validation_rules
\dt port_configurations
```

### **Step 3: Start Backend Server**

```powershell
python -m uvicorn Orbisporte.interfaces.api.main:app --reload --host 0.0.0.0 --port 8001
```

---

## **Usage Example**

### **Workflow: Invoice → BoE**

```
1. Upload Invoice       → POST /react/upload-document
2. Extract Data         → POST /react/extract
3. Calculate Duties     → POST /react/invoice/process-complete
4. Create BoE           → POST /react/boe/create-from-invoice
5. Validate BoE         → POST /react/boe/{id}/validate
6. Export for ICEGATE   → GET  /react/boe/{id}/export
```

### **Example API Call: Create BoE**

```bash
curl -X POST http://localhost:8001/react/boe/create-from-invoice \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": 123,
    "port_code": "INMAA1",
    "auto_validate": true
  }'
```

**Response:**
```json
{
  "success": true,
  "boe_id": 45,
  "boe_number": "MUM/IMP/2026/000045",
  "status": "validated",
  "risk_score": 15.0,
  "total_duty": 125000.50,
  "total_amount_payable": 625000.50,
  "line_items_count": 5,
  "validation_report": {
    "valid": true,
    "errors": [],
    "warnings": []
  }
}
```

---

## **BoE Data Structure**

### **Header Fields**
```python
{
  "boe_number": "MUM/IMP/2026/000045",
  "boe_date": "2026-03-01",
  "port_code": "INMAA1",
  "port_name": "Mumbai (Nhava Sheva)",

  # Importer Info
  "importer_name": "ABC Traders Pvt Ltd",
  "importer_iec": "1234567890",
  "importer_gst": "27AABCU9603R1Z5",

  # Shipment Info
  "bill_of_lading_number": "MAEU123456",
  "vessel_name": "MSC ATLANTA",
  "country_of_origin": "CHN",

  # Financial Summary
  "total_cif_value": 500000.00,
  "total_assessable_value": 550000.00,
  "total_bcd": 50000.00,
  "total_igst": 72000.00,
  "total_sws": 3000.00,
  "total_duty": 125000.00,
  "total_amount_payable": 625000.00,

  # Status
  "status": "draft",
  "validation_status": "passed",
  "risk_score": 15.0
}
```

### **Line Item Structure**
```python
{
  "line_number": 1,
  "product_description": "LED Display Panels",
  "hsn_code": "8528",
  "quantity": 100,
  "unit": "PCS",
  "unit_price": 5000.00,
  "cif_value": 500000.00,
  "assessable_value": 550000.00,

  # Duty Breakdown
  "bcd_rate": 10.0,
  "bcd_amount": 50000.00,
  "igst_rate": 18.0,
  "igst_amount": 99000.00,
  "total_duty": 154000.00
}
```

---

## **Risk Scoring Algorithm**

The system calculates a risk score (0-100) based on:

| **Risk Factor** | **Points** | **Trigger** |
|---|---|---|
| Missing required fields | +20 per field | Any mandatory field missing |
| High duty amount | +10 | Total duty > ₹1 lakh |
| Multiple HSN codes | +5 per extra | >5 unique HSN codes |
| Low HSN confidence | +15 per item | AI confidence < 80% |
| High-risk country | +10 | Iran, North Korea, Syria |

**Risk Levels:**
- **0-30**: ✅ Low Risk → Auto-approve
- **30-70**: ⚠️ Medium Risk → Manual review
- **70-100**: 🚨 High Risk → Legal review

---

## **Validation Rules**

### **Built-in Rules**

1. **Required Fields**
   - `importer_iec` (10 digits)
   - `importer_gst` (15 characters)
   - `bill_of_lading_number`
   - `country_of_origin`
   - `total_cif_value`

2. **Format Validations**
   - IEC: Must be 10 digits
   - GST: 22AAAAA0000A1Z5 format
   - BoE Date: Cannot be future date
   - Amounts: Cannot be negative

3. **Cross-field Validations**
   - Sum of line item duties = Total duty (±₹0.50 tolerance)
   - At least one line item required
   - HSN code required for all items

### **Custom Rules**

Add custom rules in `boe_validation_rules` table:

```sql
INSERT INTO boe_validation_rules (
  rule_name, rule_type, field_name,
  rule_config, error_message
) VALUES (
  'max_duty_limit', 'range', 'total_duty',
  '{"max": 1000000}', 'Total duty exceeds ₹10 lakh limit', 'warning'
);
```

---

## **Port-Specific Mapping**

Each port has different ICEGATE field requirements.

### **Mumbai (INMAA1) Format**
```json
{
  "IMP_NAME": "ABC Traders",
  "IEC_CODE": "1234567890",
  "BOE_NO": "MUM/IMP/2026/000045",
  "CIF_VALUE": 500000.00,
  "TOTAL_DUTY": 125000.00
}
```

### **Chennai (INMAA4) Format**
```json
{
  "IMPORTER_NAME": "ABC Traders",
  "IEC_NO": "1234567890",
  "BE_NUMBER": "MUM/IMP/2026/000045",
  "CIF": 500000.00,
  "DUTY_TOTAL": 125000.00
}
```

---

## **Version Control**

Every change creates a snapshot in `boe_versions`:

```python
{
  "boe_id": 45,
  "version_number": 2,
  "created_by": 123,
  "change_summary": "Updated importer GST number",
  "changed_fields": ["importer_gst"],
  "boe_snapshot": {...},  # Full BoE JSON
  "created_at": "2026-03-01T10:30:00"
}
```

---

## **Testing**

### **Test Scenario 1: Create BoE from Invoice**

1. Upload invoice with `/react/upload-document`
2. Process invoice with `/react/invoice/process-complete`
3. Create BoE with `/react/boe/create-from-invoice`
4. Verify:
   - BoE number generated
   - All duties aggregated correctly
   - Risk score calculated
   - Validation passed

### **Test Scenario 2: Validation Errors**

Create BoE with missing IEC:
```json
{
  "document_id": 123,
  "port_code": "INMAA1"
}
```

Expected validation errors:
```json
{
  "valid": false,
  "errors": ["Required field missing: importer_iec"],
  "validation_status": "failed"
}
```

### **Test Scenario 3: Export for ICEGATE**

```bash
curl http://localhost:8001/react/boe/45/export?format=json \
  -H "Authorization: Bearer TOKEN"
```

Returns port-specific format ready for ICEGATE submission.

---

## **Database Queries**

### **Get All BoEs for User**
```sql
SELECT boe_number, boe_date, port_name, status, total_duty
FROM bills_of_entry
WHERE user_id = 123
ORDER BY created_at DESC;
```

### **Get BoE with Line Items**
```sql
SELECT
  b.boe_number, b.total_duty,
  l.line_number, l.product_description, l.hsn_code, l.total_duty as line_duty
FROM bills_of_entry b
JOIN boe_line_items l ON l.boe_id = b.id
WHERE b.id = 45;
```

### **Get Validation Errors**
```sql
SELECT boe_number, validation_status, validation_errors
FROM bills_of_entry
WHERE validation_status = 'failed';
```

---

## **Next Steps**

### **Enhancements (Optional)**

1. **ICEGATE API Integration** (Module 9)
   - Actual filing to customs portal
   - Real-time status tracking

2. **Document Upload**
   - Attach supporting documents (invoice PDF, COO, etc.)
   - Evidence bundle generation

3. **Approval Workflow**
   - Multi-level approval for high-risk BoEs
   - Email notifications

4. **Analytics Dashboard**
   - Total duties paid
   - Average processing time
   - Validation success rate

---

## **Files Created**

```
backend/
├── migrations/
│   └── 003_bill_of_entry_tables.sql          # Database schema ✅
├── Orbisporte/
│   ├── config/
│   │   ├── __init__.py                        # Config module
│   │   └── port_field_mappings.py             # Port mappings ✅
│   ├── domain/services/
│   │   └── boe_autofill.py                    # Core service ✅
│   └── interfaces/api/
│       └── routes.py                          # API endpoints (updated) ✅
└── MODULE3_BOE_AUTOFILL_README.md             # This file ✅
```

---

## **Summary**

✅ **Module 3 Status: COMPLETE**

**Implemented Features:**
- ✅ Auto-fill BoE from invoice
- ✅ Port-specific field mapping
- ✅ Duty aggregation
- ✅ Risk scoring (0-100)
- ✅ Business rule validation
- ✅ Version control
- ✅ ICEGATE export

**API Endpoints:** 5 endpoints
**Database Tables:** 5 tables
**Validation Rules:** 6 built-in rules
**Supported Ports:** 4 ports

**Ready for Production Testing!** 🚀

---

## **Support**

For questions or issues:
- Check logs: `logger.info("[BoE] ...")`
- Database issues: Verify migration ran successfully
- API errors: Check `/docs` for request format

**Author:** OrbisPorté Development Team
**Company:** SPECTRA AI PTE. LTD., Singapore
**Date:** March 1, 2026
