# OrbisPorté Development Roadmap
## Gap Analysis & Implementation Strategy

**Document Date**: February 22, 2026
**Platform**: OrbisPorté - The AI-Driven Global Trade Automation & Customs Platform
**Company**: SPECTRA AI PTE. LTD., Singapore

---

## Executive Summary

This roadmap identifies the gap between the current implementation and the comprehensive design specifications outlined in "End-to-End Black-Box Design for AI-Powered Indian Customs & CHA Workflows-Nov 15, 2025.pdf".

**Current Status**: Basic document upload and extraction functionality
**Target State**: 10 AI-powered modules for complete customs automation
**Implementation Timeline**: 4 phases over 6-9 months

---

## 1. Current Implementation Assessment

### ✅ Implemented Features
- **Document Upload**: Single/bulk PDF upload via React frontend
- **Basic OCR**: PDF text extraction using pdf-processor
- **Document Classification**: Simple document type detection
- **User Authentication**: Login/signup with JWT tokens
- **Dashboard UI**: React-based interface with Redux state management
- **API Infrastructure**: FastAPI backend with `/react/*` endpoints
- **Database**: PostgreSQL with basic schema

### ❌ Missing Critical Features (from Design Document)

**Module 1: Advanced OCR + Document Parsing**
- LayoutLM-based document layout understanding
- Ensemble OCR (Tesseract + TrOCR for handwritten text)
- TableNet for table extraction
- Transformer NER for field extraction
- Confidence scoring (0-1 scale)
- Provenance tracking (page, bbox coordinates)

**Module 2: HSN/ECCN Classifier**
- Transformer + XGBoost ensemble model
- FAISS similarity search over 20,000+ codes
- Confidence calibration using Platt scaling
- Top-5 predictions with explanations
- 88% accuracy target

**Module 3: BoE Auto-fill & Editor**
- Port-specific schema mapping (JNCH, Mumbai, Delhi, Chennai)
- Auto-fill 80+ fields from extraction
- XSD validation against official schemas
- Version control and change tracking
- Risk-based routing (Red/Orange/Green channel)

**Module 4: Multi-layered Duty Handling**
- BCD (Basic Customs Duty) calculation
- CESS and special duty handling
- ADD (Anti-Dumping Duty) lookup
- Legal priority resolver for conflicting rules
- Versioned duty rate database

**Module 5: Duty Calculation Engine**
- Precise mathematical formulas (BCD, CESS, IGST)
- Assessable value calculation
- Rounding and precision rules (₹1 precision)
- Complete audit trail with formula breakdown

**Module 6: FTA & Concessional Scheme Optimization**
- Eligibility checker for 15+ FTA agreements
- ILP (Integer Linear Programming) optimizer
- Cost model comparing standard vs. FTA duty
- Certificate of Origin validation
- Scheme recommendations with savings estimate

**Module 7: Dynamic Exemption & Notification Tracking**
- Gazette feed ingestion (CBIC notifications)
- NER-based notification parsing
- Conflict detection engine
- Real-time alert system
- Automatic rule updates

**Module 8: Automated Valuation + Dispute Intelligence**
- WTO valuation methods implementation
- Case-law semantic search using RAG (Retrieval-Augmented Generation)
- Dispute language generator
- Market price comparison API
- Legal precedent matching

**Module 9: Localized Compliance & Filing Formats**
- Port-specific schema adapters
- ICEGATE integration
- e-Sanchit format support
- Multi-channel submission (API/Portal)
- Status tracking webhooks

**Module 10: Evidence Bundle Export & Admin**
- Digital signing (SHA256 + RSA)
- PDF report generation with annexures
- Bulk processing engine (100+ docs/batch)
- Admin workflow management
- Audit log export

---

## 2. Dependency Map & Implementation Order

```
Phase 1 (Foundation) - Months 1-2
├── Module 1: Advanced OCR ← Must come first (data source for all)
└── Module 2: HSN Classifier ← Depends on Module 1 extraction

Phase 2 (Core Customs Logic) - Months 3-4
├── Module 4: Multi-layered Duty ← Depends on Module 2 (HSN codes)
├── Module 5: Duty Calculation ← Depends on Module 4 (duty rates)
└── Module 7: Exemption Tracking ← Parallel to duty modules

Phase 3 (Advanced Features) - Months 5-6
├── Module 6: FTA Optimization ← Depends on Module 5 (duty calc)
├── Module 8: Valuation + Dispute ← Depends on Module 5 (duty calc)
└── Module 3: BoE Auto-fill ← Depends on Modules 1, 2, 4, 5

Phase 4 (Integration & Export) - Months 7-9
├── Module 9: Compliance & Filing ← Depends on Module 3 (BoE)
├── Module 10: Evidence Bundle ← Depends on all modules
└── Testing, QA, Performance Optimization
```

---

## 3. Detailed Phase Breakdown

### 📦 Phase 1: Foundation (Months 1-2)
**Goal**: Robust data extraction and classification

#### Module 1: Advanced OCR + Document Parsing
**Priority**: 🔴 CRITICAL - Blocks all other modules
**Complexity**: ⭐⭐⭐⭐ (High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: Document Layout Understanding
   - Integrate LayoutLM model for document structure detection
   - Train on Indian customs documents (BoE, Shipping Bill, Invoice)
   - Implement page segmentation (header, table, footer zones)

2. **Week 3-4**: Enhanced OCR Pipeline
   - Deploy Tesseract 5.x for printed text
   - Add TrOCR for handwritten annotations
   - Implement ensemble voting for confidence scoring
   - Set up confidence threshold (>0.85 for auto-accept)

3. **Week 5-6**: Table Extraction
   - Integrate TableNet or similar model
   - Implement table structure recognition
   - Extract line items with quantities, rates, values
   - Handle multi-page tables

4. **Week 7-8**: Field Extraction & Validation
   - Train Transformer NER model on customs fields
   - Extract: IEC, GSTIN, Invoice No., Port Code, CIF Value, etc.
   - Add provenance tracking (page number, bbox coordinates)
   - Implement field-level confidence scoring

**Deliverables**:
- API endpoint: `POST /api/ocr/advanced-extract`
- Response format:
  ```json
  {
    "document_id": "uuid",
    "confidence_overall": 0.92,
    "fields": [
      {
        "name": "IEC_CODE",
        "value": "0123456789",
        "confidence": 0.95,
        "provenance": {"page": 1, "bbox": [100, 200, 300, 220]}
      }
    ],
    "tables": [...],
    "raw_text": "..."
  }
  ```

**Success Metrics**:
- Field extraction accuracy: >90%
- Table extraction accuracy: >85%
- Processing time: <30 seconds per document
- Confidence calibration error: <5%

---

#### Module 2: HSN/ECCN Classifier
**Priority**: 🔴 CRITICAL - Required for duty calculation
**Complexity**: ⭐⭐⭐⭐ (High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: Data Preparation
   - Load 20,000+ HSN codes from CBIC database
   - Create training dataset from historical BoEs
   - Label product descriptions with correct HSN codes
   - Split data: 70% train, 15% val, 15% test

2. **Week 3-4**: Model Development
   - Train Transformer model (BERT/RoBERTa) on descriptions
   - Train XGBoost on numeric/categorical features
   - Implement ensemble weighting (70% Transformer, 30% XGBoost)
   - Apply Platt scaling for confidence calibration

3. **Week 5-6**: Similarity Search
   - Build FAISS index over HSN embeddings
   - Implement semantic search for ambiguous cases
   - Add Top-5 predictions with explanations
   - Create decision boundary visualization

4. **Week 7-8**: Integration & Testing
   - API endpoint: `POST /api/classify/hsn`
   - Add human-in-the-loop for low confidence (<0.7)
   - Implement feedback loop for model improvement
   - Create UI widget for HSN selection

**Deliverables**:
- API endpoint: `POST /api/classify/hsn`
- Request:
  ```json
  {
    "description": "Cotton T-shirts, size M, pack of 10",
    "quantity": 100,
    "unit": "PCS",
    "country_of_origin": "Bangladesh"
  }
  ```
- Response:
  ```json
  {
    "predictions": [
      {
        "hsn_code": "6109100010",
        "description": "Cotton T-shirts and singlets, knitted",
        "confidence": 0.88,
        "explanation": "Matched on keywords: cotton, t-shirts"
      },
      {...}  // Top-5 total
    ]
  }
  ```

**Success Metrics**:
- Top-1 accuracy: >88%
- Top-5 accuracy: >97%
- Inference time: <500ms per item
- Calibration error (ECE): <3%

---

### ⚙️ Phase 2: Core Customs Logic (Months 3-4)
**Goal**: Implement duty calculation and exemption tracking

#### Module 4: Multi-layered Duty Handling
**Priority**: 🟠 HIGH
**Complexity**: ⭐⭐⭐⭐⭐ (Very High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: Duty Rate Database
   - Import CBIC duty schedules (BCD, CESS, ADD)
   - Create versioned duty_rates table with effective dates
   - Implement temporal queries (AS OF date)
   - Add duty type hierarchy (BCD > CESS > ADD)

2. **Week 3-4**: Legal Priority Resolver
   - Implement conflict resolution rules
   - Handle notification precedence (latest wins)
   - Support exemption overrides
   - Create decision audit log

3. **Week 5-6**: Duty Stacking Engine
   - Calculate BCD on CIF value
   - Calculate CESS on (CIF + BCD)
   - Calculate IGST on assessable value
   - Handle anti-dumping duties separately

4. **Week 7-8**: Integration & Testing
   - API endpoint: `POST /api/duty/lookup`
   - Test against 100+ real cases
   - Validate against ICEGATE results
   - Document all edge cases

**Deliverables**:
- API endpoint: `POST /api/duty/lookup`
- Database schema:
  ```sql
  CREATE TABLE duty_rates (
    id SERIAL PRIMARY KEY,
    hsn_code VARCHAR(10),
    duty_type VARCHAR(20),  -- BCD, CESS, ADD, CVD
    rate_percent DECIMAL(5,2),
    effective_from DATE,
    effective_to DATE,
    notification_number VARCHAR(50),
    legal_priority INT
  );
  ```

**Success Metrics**:
- Rate lookup accuracy: 100%
- Conflict resolution accuracy: >95%
- Query time: <100ms
- Zero manual corrections needed

---

#### Module 5: Duty Calculation Engine
**Priority**: 🟠 HIGH
**Complexity**: ⭐⭐⭐ (Medium)
**Estimated Effort**: 4-6 weeks

**Implementation Tasks**:
1. **Week 1-2**: Formula Implementation
   - BCD = CIF × BCD_rate
   - Assessable Value = CIF + BCD + CESS
   - IGST = Assessable Value × IGST_rate
   - Social Welfare Surcharge = (BCD + CESS) × 10%
   - Apply ₹1 rounding precision

2. **Week 3-4**: Audit Trail
   - Log every calculation step
   - Store intermediate values
   - Generate human-readable formula breakdown
   - Support "show your work" feature

3. **Week 5-6**: Integration & UI
   - API endpoint: `POST /api/duty/calculate`
   - Create Duty Calculator UI widget
   - Add formula visualization
   - Implement export to Excel

**Deliverables**:
- API endpoint: `POST /api/duty/calculate`
- Response:
  ```json
  {
    "cif_value": 100000.00,
    "bcd": 10000.00,
    "cess": 1000.00,
    "assessable_value": 111000.00,
    "igst": 19980.00,
    "sws": 1100.00,
    "total_duty": 32080.00,
    "audit_trail": [
      "BCD = ₹100,000 × 10% = ₹10,000",
      "CESS = ₹100,000 × 1% = ₹1,000",
      ...
    ]
  }
  ```

**Success Metrics**:
- Calculation accuracy: 100% (verified against ICEGATE)
- Audit trail completeness: 100%
- Processing time: <50ms
- Rounding errors: 0

---

#### Module 7: Dynamic Exemption & Notification Tracking
**Priority**: 🟡 MEDIUM (can run in parallel)
**Complexity**: ⭐⭐⭐⭐ (High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: Gazette Ingestion
   - Scrape CBIC website for notifications
   - Parse PDF/HTML gazette documents
   - Extract notification number, date, subject
   - Store in notifications table

2. **Week 3-4**: NER-based Parsing
   - Train NER model to extract:
     - HSN codes affected
     - Duty rate changes
     - Effective dates
     - Exemption conditions
   - Validate extracted data

3. **Week 5-6**: Conflict Detection
   - Compare new notifications with existing rules
   - Flag superseded notifications
   - Detect contradictions
   - Suggest resolution

4. **Week 7-8**: Alert System
   - Email alerts for relevant notifications
   - In-app notification center
   - RSS feed for changes
   - Webhook support

**Deliverables**:
- Background job: `notification_scraper` (runs daily)
- API endpoint: `GET /api/notifications/latest`
- UI: Notification Center with filters

**Success Metrics**:
- Notification capture rate: >99%
- NER accuracy: >90%
- Alert latency: <24 hours from gazette publication
- False positive rate: <5%

---

### 🚀 Phase 3: Advanced Features (Months 5-6)

#### Module 6: FTA & Concessional Scheme Optimization
**Priority**: 🟡 MEDIUM
**Complexity**: ⭐⭐⭐⭐⭐ (Very High)
**Estimated Effort**: 8-10 weeks

**Implementation Tasks**:
1. **Week 1-3**: FTA Database
   - Load 15+ FTA agreements (ASEAN, SAFTA, India-UAE, etc.)
   - Create eligibility rules database
   - Map HSN codes to FTA-specific concessions
   - Implement Certificate of Origin validation

2. **Week 4-6**: Cost Model & Optimizer
   - Calculate standard duty scenario
   - Calculate FTA scenario (considering CoO cost)
   - Implement ILP optimizer (using PuLP or similar)
   - Find optimal scheme combination

3. **Week 7-8**: Risk Adjustment
   - Factor in SVB (Special Valuation Branch) audit risk
   - Weight by documentary burden
   - Consider processing time delays
   - Provide risk-adjusted recommendations

4. **Week 9-10**: UI & Integration
   - Create FTA Optimizer UI panel
   - Show side-by-side comparison
   - Display savings estimate
   - Generate recommendation report

**Deliverables**:
- API endpoint: `POST /api/optimize/fta`
- UI: FTA Optimizer panel in dashboard
- Report: "FTA Savings Analysis" PDF export

**Success Metrics**:
- Optimization accuracy: Savings within ±5% of manual calculation
- Processing time: <5 seconds for 50 line items
- FTA coverage: 15+ agreements
- User adoption: >60% use recommendations

---

#### Module 8: Automated Valuation + Dispute Intelligence
**Priority**: 🟡 MEDIUM
**Complexity**: ⭐⭐⭐⭐⭐ (Very High)
**Estimated Effort**: 8-10 weeks

**Implementation Tasks**:
1. **Week 1-3**: WTO Valuation Methods
   - Implement Method 1: Transaction Value
   - Implement Method 2-6: Fallback methods
   - Add deductive/computed value calculation
   - Create decision tree for method selection

2. **Week 4-6**: Case-Law RAG System
   - Collect 1000+ customs tribunal rulings
   - Create embeddings using Sentence-BERT
   - Build FAISS vector store
   - Implement semantic search

3. **Week 7-8**: Dispute Language Generator
   - Fine-tune GPT model on legal language
   - Generate dispute letter templates
   - Cite relevant case law
   - Include precedent references

4. **Week 9-10**: Market Price Comparison
   - Integrate with market price APIs
   - Compare declared vs. market price
   - Flag outliers (>20% deviation)
   - Generate valuation report

**Deliverables**:
- API endpoint: `POST /api/valuation/assess`
- API endpoint: `POST /api/dispute/generate`
- UI: Valuation Assistant panel
- Database: case_law table with 1000+ rulings

**Success Metrics**:
- Valuation accuracy: >90% match with customs assessment
- Case-law relevance: >80% precision in top-3 results
- Dispute success rate: >40% favorable outcomes
- Processing time: <10 seconds

---

#### Module 3: BoE Auto-fill & Editor
**Priority**: 🟠 HIGH (depends on Modules 1, 2, 4, 5)
**Complexity**: ⭐⭐⭐⭐ (High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: Schema Mapping
   - Download XSD schemas for each port (JNCH, Mumbai, etc.)
   - Create field mapping: extracted_data → BoE fields
   - Handle port-specific variations
   - Support version migration

2. **Week 3-4**: Auto-fill Engine
   - Map 80+ BoE fields from OCR extraction
   - Map HSN codes from classifier
   - Populate duty values from calculator
   - Leave ambiguous fields blank

3. **Week 5-6**: XSD Validation
   - Validate against official XSD
   - Check mandatory fields
   - Validate data types and formats
   - Generate validation report

4. **Week 7-8**: Version Control & UI
   - Implement draft save/restore
   - Track changes with diff viewer
   - Add risk-based routing (Red/Orange/Green)
   - Create BoE Editor UI

**Deliverables**:
- API endpoint: `POST /api/boe/autofill`
- API endpoint: `POST /api/boe/validate`
- UI: BoE Editor with auto-fill button
- Database: boe_drafts table with version history

**Success Metrics**:
- Auto-fill coverage: >80% of fields populated
- Validation accuracy: 100% (no XSD errors)
- Manual correction time: <5 minutes per BoE
- Error rate: <2%

---

### 🔗 Phase 4: Integration & Export (Months 7-9)

#### Module 9: Localized Compliance & Filing Formats
**Priority**: 🔴 CRITICAL (for production use)
**Complexity**: ⭐⭐⭐⭐ (High)
**Estimated Effort**: 6-8 weeks

**Implementation Tasks**:
1. **Week 1-2**: ICEGATE Integration
   - Obtain ICEGATE API credentials
   - Implement authentication flow
   - Map BoE fields to ICEGATE schema
   - Test with sandbox environment

2. **Week 3-4**: e-Sanchit Support
   - Generate e-Sanchit compliant XML
   - Add digital signature support
   - Implement document attachment handling
   - Support multi-document submission

3. **Week 5-6**: Multi-Channel Submission
   - Implement API submission
   - Support manual portal upload (generate pre-filled form)
   - Add webhook handlers for status updates
   - Create submission queue

4. **Week 7-8**: Status Tracking
   - Poll ICEGATE for status updates
   - Store submission history
   - Send notifications on status change
   - Generate submission report

**Deliverables**:
- API endpoint: `POST /api/filing/submit`
- API endpoint: `GET /api/filing/status/{submission_id}`
- UI: Filing Status Dashboard
- Integration: ICEGATE API client

**Success Metrics**:
- Submission success rate: >95%
- Status update latency: <1 hour
- Error handling: Auto-retry on transient failures
- Compliance: 100% schema validation pass

---

#### Module 10: Evidence Bundle Export & Admin
**Priority**: 🟡 MEDIUM
**Complexity**: ⭐⭐⭐ (Medium)
**Estimated Effort**: 4-6 weeks

**Implementation Tasks**:
1. **Week 1-2**: Evidence Bundle Generator
   - Compile all related documents (invoice, BoE, CoO, etc.)
   - Generate comprehensive PDF report
   - Include annexures and supporting docs
   - Add table of contents

2. **Week 3-4**: Digital Signing
   - Implement SHA256 hashing
   - Add RSA digital signature
   - Generate signature certificate
   - Support timestamp authority

3. **Week 5-6**: Bulk Processing & Admin
   - Implement batch upload (100+ docs)
   - Create processing queue with Redis
   - Add admin workflow management
   - Implement audit log export

**Deliverables**:
- API endpoint: `POST /api/export/evidence-bundle`
- API endpoint: `POST /api/admin/bulk-process`
- UI: Admin Dashboard with queue management
- Feature: Digital signature verification

**Success Metrics**:
- Bundle generation time: <30 seconds
- Signature validation: 100% success
- Bulk processing: 100+ docs in <10 minutes
- Admin efficiency: 50% reduction in manual processing time

---

## 4. Technology Stack Recommendations

### Backend
- **Framework**: FastAPI (existing) + Celery for async tasks
- **ML Models**:
  - Transformers: Hugging Face (BERT, LayoutLM, TrOCR)
  - Classification: XGBoost, scikit-learn
  - Optimization: PuLP (ILP solver)
- **Vector DB**: FAISS or Pinecone (for similarity search)
- **OCR**: Tesseract 5.x + Azure Computer Vision API
- **Database**: PostgreSQL (existing) + Redis (queue/cache)

### Frontend
- **Framework**: React 18 (existing) with TypeScript migration
- **State Management**: Redux Toolkit (existing)
- **UI Components**: Material-UI or Ant Design for complex forms
- **Charts**: Recharts or Chart.js for analytics
- **PDF Viewer**: PDF.js (existing)

### DevOps
- **Containerization**: Docker + Docker Compose
- **Orchestration**: Kubernetes (for production scale)
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)

### Third-Party Services
- **OCR**: Azure Computer Vision (for handwriting)
- **ML Hosting**: AWS SageMaker or GCP Vertex AI
- **Storage**: AWS S3 or Azure Blob Storage
- **ICEGATE**: Official CBIC API integration

---

## 5. Resource Requirements

### Team Structure
- **Backend Developers**: 2-3 (FastAPI, ML integration)
- **ML Engineers**: 2 (Model training, deployment)
- **Frontend Developers**: 2 (React, UI/UX)
- **DevOps Engineer**: 1 (Infrastructure, deployment)
- **Domain Expert**: 1 (Customs regulations, CHA workflows)
- **QA Engineer**: 1 (Testing, validation)
- **Project Manager**: 1 (Coordination, stakeholder management)

**Total Team Size**: 9-11 people

### Infrastructure Costs (Monthly Estimate)
- **Cloud Compute**: $2,000-3,000 (GPU instances for ML)
- **Storage**: $500-1,000 (document storage)
- **Database**: $300-500 (managed PostgreSQL)
- **Third-Party APIs**: $1,000-2,000 (OCR, market data)
- **Monitoring/Logging**: $200-300
- **Total**: $4,000-7,000/month

---

## 6. Risk Mitigation

### Technical Risks
1. **ML Model Accuracy**: Continuous retraining, human-in-the-loop
2. **ICEGATE API Changes**: Version control, adapter pattern
3. **Data Quality**: Validation pipelines, manual review queues
4. **Performance**: Horizontal scaling, caching, async processing

### Business Risks
1. **Regulatory Changes**: Modular architecture, configurable rules
2. **User Adoption**: Phased rollout, training programs
3. **Competition**: Focus on unique value (AI optimization)
4. **Data Security**: Encryption, access controls, audit logs

### Mitigation Strategies
- **Agile Development**: 2-week sprints with regular demos
- **Stakeholder Engagement**: Weekly progress updates
- **Pilot Program**: Test with 5-10 CHAs before full launch
- **Fallback Plans**: Manual override for all automated decisions

---

## 7. Success Metrics & KPIs

### Phase 1 (Foundation)
- [ ] OCR field extraction >90% accuracy
- [ ] HSN classification >88% Top-1 accuracy
- [ ] Processing time <30 seconds/document

### Phase 2 (Core Logic)
- [ ] Duty calculation 100% accurate vs. ICEGATE
- [ ] Zero manual duty corrections needed
- [ ] Notification capture >99% complete

### Phase 3 (Advanced Features)
- [ ] FTA optimization savings >10% average
- [ ] BoE auto-fill >80% field coverage
- [ ] Valuation accuracy >90%

### Phase 4 (Production)
- [ ] ICEGATE submission success >95%
- [ ] End-to-end processing time <10 minutes
- [ ] User satisfaction score >4.5/5
- [ ] Cost reduction for CHAs >30%

---

## 8. Implementation Timeline (Gantt Chart)

```
Month 1-2: Phase 1 Foundation
├── Module 1: Advanced OCR ████████████████
└── Module 2: HSN Classifier ████████████████

Month 3-4: Phase 2 Core Logic
├── Module 4: Duty Handling  ████████████████
├── Module 5: Duty Calculation ████████████
└── Module 7: Notifications  ████████████████

Month 5-6: Phase 3 Advanced
├── Module 6: FTA Optimization ████████████████████
├── Module 8: Valuation/Dispute ████████████████████
└── Module 3: BoE Auto-fill  ████████████████

Month 7-9: Phase 4 Integration
├── Module 9: ICEGATE Filing ████████████████
├── Module 10: Evidence Export ████████████
├── Testing & QA             ████████████████
└── Production Deployment    ████████
```

---

## 9. Next Steps (Immediate Actions)

### Week 1-2: Project Setup
1. ✅ Review and approve this roadmap
2. 🔲 Assemble development team
3. 🔲 Set up development environment
4. 🔲 Create project repositories (backend-ml, frontend)
5. 🔲 Establish CI/CD pipelines
6. 🔲 Set up project management tools (Jira/Linear)

### Week 3-4: Phase 1 Kickoff
1. 🔲 Collect training data for OCR (500+ documents)
2. 🔲 Set up ML environment (GPU instances)
3. 🔲 Begin LayoutLM integration
4. 🔲 Start HSN code database import
5. 🔲 Create API specifications for all endpoints

### Week 5-6: First Milestone
1. 🔲 Demo: Advanced OCR extraction with confidence scores
2. 🔲 Demo: HSN classifier with Top-5 predictions
3. 🔲 Stakeholder review and feedback
4. 🔲 Adjust roadmap based on learnings

---

## 10. Conclusion

This roadmap provides a structured path from the current basic implementation to a comprehensive AI-powered customs automation platform. By following this phased approach:

- **Phase 1** establishes robust data extraction and classification
- **Phase 2** implements core duty calculation logic
- **Phase 3** adds advanced optimization and intelligence features
- **Phase 4** integrates with official systems and enables production use

**Estimated Total Timeline**: 7-9 months
**Estimated Total Cost**: $30,000-60,000 (excluding salaries)
**Expected ROI**: 30-50% cost reduction for CHAs, 10x faster processing

The modular architecture allows for flexibility—modules can be prioritized differently based on business needs, and MVP releases can happen after Phase 2 (core duty calculation working).

**Recommended Immediate Priority**: Begin Phase 1 (Module 1: Advanced OCR) as it unblocks all subsequent development.

---

**Document Prepared By**: Claude (AI Assistant)
**For**: SPECTRA AI PTE. LTD., Singapore
**Date**: February 22, 2026
**Version**: 1.0
