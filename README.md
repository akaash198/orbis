# Orbisporte - AI-Powered Indian Customs Platform

Modern, AI-powered document processing platform specifically designed for Indian Customs operations. Orbisporte streamlines customs documentation, automates HS Code classification, and generates ICEGATE-compliant customs declarations.

## Overview

Orbisporte is a comprehensive solution for Indian customs brokers, importers, exporters, and customs officers to:
- **Process Documents**: Automatically classify and extract data from Bills of Entry, Shipping Bills, invoices, and packing lists
- **Classify HS Codes**: AI-powered Harmonized System code lookup and classification
- **Validate Compliance**: Real-time GST and IEC code validation
- **Generate Declarations**: Create ICEGATE-ready customs declarations
- **Get Instant Answers**: AI chatbot for document-related questions

## Key Features

### 🇮🇳 Indian Customs Focused
- **ICEGATE Integration**: Generate customs declarations compatible with ICEGATE portal
- **GST Validation**: Automatic GST number verification for compliance
- **IEC Validation**: Import Export Code validation
- **Bill of Entry**: Automated import declaration processing
- **Shipping Bill**: Streamlined export declaration generation

### 🤖 AI-Powered Intelligence
- Document classification using LLM
- Smart data extraction from unstructured documents
- Intelligent HS Code lookup
- Document Q&A chatbot
- Semantic search using vector embeddings

### ⚡ Modern Technology
- React 18 frontend with beautiful UI
- FastAPI backend (ready to integrate)
- Real-time processing with async tasks
- Secure JWT authentication
- Responsive design for all devices

## Project Structure

```
Orbisporte/
├── orbisporte-ui/          # React frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── contexts/       # State management contexts
│   │   ├── services/       # API integration layer
│   │   ├── store/          # Redux store
│   │   └── styles/         # Theme and global styles
│   ├── public/
│   └── package.json
└── README.md               # This file
```

## Quick Start

### Run Without Docker

You can run the platform directly on your machine with local PostgreSQL.

1. Start PostgreSQL locally and create the database:
```sql
CREATE DATABASE orbisporte_db;
```

2. Configure the backend in `backend/.env`.
The important values are:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_postgres_password
DB_NAME=orbisporte_db
DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/orbisporte_db
```

3. Install backend dependencies and initialize the schema:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python init_db.py
```
If you need the heavier document-intelligence or fraud modules later, install `backend/requirements-optional.txt` after the core set.

4. Start the backend:
```powershell
uvicorn Orbisporte.interfaces.api.main:app --reload --host 0.0.0.0 --port 8000
```

5. In a second terminal, start the frontend:
```powershell
cd orbisporte-ui
npm install
$env:REACT_APP_API_BASE_URL="http://localhost:8000"
npm start
```

6. Open the app:
```text
http://localhost:3000
```

Notes:
- Redis, Kafka, and Celery are optional for basic local development.
- The backend still requires PostgreSQL because the schema uses PostgreSQL-specific types.

### Frontend Setup

1. **Navigate to UI directory:**
```bash
cd orbisporte-ui
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` to set your backend API URL:
```
REACT_APP_API_BASE_URL=http://localhost:8000
```

4. **Start development server:**
```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

### Backend Setup (To Be Integrated)

The frontend expects a FastAPI backend running on `http://localhost:8000` with the following endpoints:

**Authentication:**
- `POST /react/login`
- `POST /react/signup`
- `POST /react/logout`
- `POST /react/refresh-token`

**Documents:**
- `POST /react/upload-document`
- `POST /react/classify-document`
- `POST /react/extract-data`
- `GET /react/documents`

**Indian Customs:**
- `POST /react/hscode-lookup`
- `POST /react/validate-gst`
- `POST /react/validate-iec`
- `POST /react/generate-customs-declaration`

**Q&A:**
- `POST /react/ask-question`
- `GET /react/chat-history/:id`

## Features in Detail

### 📊 Dashboard
- Overview of processed documents
- Quick access to key features
- Statistics and metrics
- Recent activity feed

### 📄 Document Management
- Drag-and-drop document upload
- Support for PDF, JPG, PNG formats
- Automatic document classification
- Batch processing capabilities
- Document preview and download

### 🏷️ HS Code Lookup
- AI-powered product classification
- Detailed HS Code descriptions
- Confidence scoring
- India-specific 8-digit codes
- Historical lookup records

### 🌐 Customs Declaration
- ICEGATE-compliant format generation
- GST number validation
- IEC code verification
- Bill of Entry processing
- Shipping Bill creation
- Automated form filling

### 💬 Document Q&A
- Natural language queries
- Context-aware responses
- Chat history
- Multi-document support
- Export conversations

### ⚙️ Settings
- User profile management
- Company information
- API configuration
- Notification preferences

## User Roles

The platform supports different user roles for Indian Customs operations:

- **Customs Officer**: Government customs officials
- **Customs Broker**: Licensed customs brokers
- **Importer**: Importing companies
- **Exporter**: Exporting companies
- **Freight Forwarder**: Logistics companies
- **CHA**: Customs House Agents

## Technology Stack

### Frontend
- **React 18**: Modern UI library
- **Redux Toolkit**: State management
- **React Router**: Navigation
- **Styled Components**: Styling
- **Axios**: API communication
- **PDF.js**: PDF viewing

### Backend (To Be Integrated)
- **FastAPI**: Modern Python API framework
- **PostgreSQL**: Database with pgvector
- **Redis**: Caching and task queue
- **Celery**: Async task processing
- **LLM Integration**: OpenAI/GPT for AI features

## Color Theme

Orbisporte uses an Indian flag-inspired color scheme:

- **Primary**: `#FF6B35` (Saffron orange)
- **Secondary**: `#138808` (Deep green)
- **Accent**: `#004C99` (Navy blue for customs)
- **Success**: `#138808` (Green)
- **Warning**: `#FFA500` (Orange)

## Security

- JWT-based authentication with refresh tokens
- Secure password hashing
- Token expiration and auto-refresh
- Protected routes
- Role-based access control (ready)
- HTTPS recommended for production

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Development Roadmap

### Phase 1: Frontend (Current) ✅
- React UI with all panels
- Authentication flow
- Document management interface
- HS Code lookup UI
- Customs declaration forms
- Q&A chatbot interface

### Phase 2: Backend Integration (Next)
- Connect to FastAPI backend
- Implement document processing
- Add LLM integration
- Enable real-time features
- Database setup

### Phase 3: Advanced Features (Future)
- OCR for scanned documents
- Barcode/QR code scanning
- Multi-language support
- Mobile app
- API for third-party integration
- Advanced analytics

## Contributing

We welcome contributions! Here's how you can help:

1. **Report Bugs**: Open an issue with detailed reproduction steps
2. **Suggest Features**: Describe your idea and use case
3. **Submit PRs**: Fork, create a feature branch, and submit a PR
4. **Documentation**: Improve docs and examples
5. **Testing**: Help test new features

## License

MIT License - See LICENSE file for details

## Support

For questions and support:
- Email: support@orbisporte.com (placeholder)
- Documentation: Check the README files
- Issues: GitHub Issues (if applicable)

## Acknowledgments

- Built for the Indian Customs community
- Inspired by ICEGATE and modern customs workflows
- Designed to streamline import/export operations
- Powered by AI to reduce manual work

---

**Orbisporte** - Transforming Indian Customs with AI ⚡🇮🇳

*Version 1.0.0*
