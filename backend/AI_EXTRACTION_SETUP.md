# 🤖 AI Document Extraction - Setup Guide

Orbisporte now has **REAL AI document extraction** powered by NEXORA's logic!

## ✅ What's Been Added

- ✅ **Document Classification** - AI identifies document types (Invoice, Bill of Lading, etc.)
- ✅ **Data Extraction** - Extracts structured data from documents
- ✅ **HS Code Lookup** - AI-powered HS Code identification
- ✅ **Document Q&A** - Ask questions about your documents
- ✅ **Barcode/QR Scanning** - Extract barcodes and QR codes

All using the same AI logic as NEXORA!

---

## 🚀 Quick Setup (3 Steps)

### Step 1: Install New Dependencies

```powershell
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`\backend"
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

This installs:
- OpenAI SDK
- LangChain
- PyMuPDF (PDF processing)
- OpenCV (barcode scanning)
- ChromaDB (vector embeddings)

### Step 2: Add OpenAI API Key

1. **Get an OpenAI API key:**
   - Go to https://platform.openai.com/api-keys
   - Click "Create new secret key"
   - Copy the key (starts with `sk-...`)

2. **Add to `.env` file:**

Open `backend/.env` and update:
```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 3: Restart Backend

```powershell
# Stop the current backend (Ctrl+C)
# Then restart:
uvicorn Orbisporte.interfaces.api.main:app --reload
```

**Done!** AI extraction is now enabled! 🎉

---

## 📋 Testing AI Extraction

### Test 1: Upload and Classify

1. Go to http://localhost:3001
2. Upload a document (PDF, JPG, PNG)
3. Click "Classify" - AI will identify the document type
4. See results: "Invoice", "Bill of Lading", etc.

### Test 2: Extract Data

1. After classification, click "Extract"
2. AI extracts:
   - Invoice numbers
   - Dates
   - Amounts
   - Line items
   - Company details
   - And more!

### Test 3: HS Code Lookup

1. Go to "HS Code" panel
2. Enter product description: "Cotton fabric"
3. AI returns matching HS codes with descriptions

### Test 4: Document Q&A

1. Go to "Q&A" panel
2. Upload a document
3. Ask questions like:
   - "What is the invoice number?"
   - "Who is the supplier?"
   - "What is the total amount?"

---

## 🔧 Advanced Configuration

### Using Different LLM Providers

**Option 1: Azure OpenAI**

In `.env`:
```
LLM_PROVIDER=azure
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your_azure_key_here
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4
```

**Option 2: Grok (X.AI)**

In `.env`:
```
LLM_PROVIDER=grok
GROK_API_KEY=your_grok_key_here
GROK_BASE_URL=https://api.x.ai/v1
```

### Adjusting Settings

In `.env`:
```
# Maximum file size for uploads (in MB)
MAX_FILE_SIZE_MB=50

# Allowed file types
ALLOWED_FILE_EXTENSIONS=pdf,jpg,jpeg,png

# ChromaDB path for vector storage
CHROMA_DB_PATH=./static/chroma_db
```

---

## 🎯 Supported Document Types

Orbisporte can classify and extract from:

- **Invoices** (Commercial invoices, tax invoices)
- **Bills of Lading** (Air/Sea)
- **Packing Lists**
- **Purchase Orders**
- **Certificates of Origin**
- **Customs Declarations**
- **Shipping Bills**
- **Bills of Entry**

---

## 💰 Cost Considerations

**OpenAI API Pricing:**
- GPT-4: ~$0.03 per 1K tokens (input) + $0.06 per 1K tokens (output)
- Average document: ~5K-10K tokens
- **Estimated cost per document: $0.30 - $0.60**

**Tips to reduce costs:**
1. Use GPT-3.5-turbo for simple documents (10x cheaper)
2. Process in batches
3. Cache frequently accessed documents

---

## 🐛 Troubleshooting

### "Invalid API key"

❌ **Error:**
```
Authentication failed: Incorrect API key
```

✅ **Fix:**
1. Check `.env` has correct key (starts with `sk-`)
2. Verify key is active at https://platform.openai.com/api-keys
3. Restart backend after changing `.env`

### "Module not found: openai"

❌ **Error:**
```
ModuleNotFoundError: No module named 'openai'
```

✅ **Fix:**
```powershell
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### "Classification failed"

❌ **Error:**
```
Classification failed: File not found
```

✅ **Fix:**
- Make sure file exists at the path
- Check file permissions
- Verify file format (PDF, JPG, PNG only)

### "Extraction is slow"

⚠️ **Issue:** Extraction takes 15+ seconds

✅ **Solutions:**
1. Use GPT-3.5-turbo instead of GPT-4 (edit `get_llm.py`)
2. Reduce PDF page count (only extract first 10 pages)
3. Use `/react/extract-fast` endpoint (skips classification)

---

## 📊 What Changed From Before

### Before (Placeholder):
```python
# Fake data
extracted_data = {
    "invoice_number": "INV-2025-001",
    "amount": "50000.00"
}
```

### After (Real AI):
```python
# Real AI extraction using GPT-4
svc = DocumentExtractionService()
extracted_data = svc.extract_data(file_path, doc_type)
# Returns actual data from the document!
```

---

## 🔄 API Endpoint Changes

### Updated Endpoints:

| Endpoint | Before | After |
|----------|--------|-------|
| `/react/classify` | Placeholder | Real AI classification |
| `/react/extract` | Fake data | Real extraction with GPT-4 |
| `/react/hscode` | Static | AI-powered HS Code lookup |
| `/react/qa` | Not available | Document chatbot |

### New Features:

- **Barcode extraction**: Set `extract_barcodes: true` in payload
- **Content hash**: Duplicate detection
- **Background processing**: Async extraction (coming soon)

---

## 📚 Next Steps

1. **Test with real documents** - Upload your actual customs documents
2. **Check extraction quality** - Verify AI extracts correct data
3. **Customize prompts** - Edit files in `Orbisporte/prompts/` to improve accuracy
4. **Monitor costs** - Track OpenAI usage at https://platform.openai.com/usage

---

## 🎉 Summary

You now have:
- ✅ Full AI document extraction (same as NEXORA)
- ✅ Document classification
- ✅ HS Code lookup
- ✅ Document Q&A chatbot
- ✅ Barcode/QR scanning

Just add your OpenAI API key and start extracting! 🚀

---

**Questions?** Check the main README or review NEXORA's implementation for reference.
