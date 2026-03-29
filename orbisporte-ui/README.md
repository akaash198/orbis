# Orbisporte UI - Indian Customs AI Platform

Modern React-based frontend for the Orbisporte AI-powered Indian Customs document processing platform.

## Features

### Core Functionality
- **AI-Powered Document Processing**: Upload and automatically classify customs documents
- **HS Code Lookup**: Intelligent Harmonized System code classification
- **Customs Declaration**: Generate ICEGATE-compliant customs declarations
- **Document Chatbot**: Ask questions about your documents using AI
- **GST & IEC Validation**: Real-time validation of Indian tax and trade codes

### Indian Customs Specific
- ICEGATE portal integration
- Bill of Entry processing
- Shipping Bill generation
- GST number validation
- IEC (Import Export Code) validation
- India-specific customs workflows

### User Experience
- Modern, responsive design
- Real-time document processing
- Secure authentication with JWT tokens
- Persistent state management with Redux
- Beautiful gradient color scheme (Indian flag-inspired)

## Tech Stack

- **React 18** - Modern UI library
- **React Router** - Client-side routing
- **Redux Toolkit** - State management
- **Redux Persist** - Persistent state
- **Styled Components** - CSS-in-JS styling
- **Axios** - HTTP client with interceptors
- **PDF.js** - PDF document viewing

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Backend API running (default: http://localhost:8000)

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp .env.example .env
```

Edit `.env` and set your API URL:
```
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_NAME=Orbisporte
REACT_APP_TAGLINE=AI-Powered Indian Customs Platform
```

3. **Start development server:**
```bash
npm start
```

The app will open at [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
```

The optimized production build will be in the `build/` folder.

## Project Structure

```
orbisporte-ui/
├── public/
│   └── index.html              # HTML template
├── src/
│   ├── components/
│   │   ├── auth/               # Login/Signup forms
│   │   ├── common/             # Reusable components
│   │   ├── layouts/            # Layout components (Header, Sidebar)
│   │   └── panels/             # Main application panels
│   ├── contexts/               # React contexts (Auth, Documents)
│   ├── hooks/                  # Custom React hooks
│   ├── services/               # API service layer
│   ├── store/                  # Redux store configuration
│   ├── styles/                 # Global styles and theme
│   ├── App.js                  # Main app component with routing
│   └── index.js                # Application entry point
├── .env.example                # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Key Components

### Authentication
- **LoginForm**: User login with JWT authentication
- **SignupForm**: New user registration
- **AuthContext**: Global authentication state

### Panels
- **DashboardPanel**: Overview and statistics
- **DocumentPanel**: Document management and upload
- **HSCodePanel**: HS Code lookup and classification
- **CustomsPanel**: GST/IEC validation and ICEGATE integration
- **QAPanel**: AI chatbot for document questions
- **SettingsPanel**: User profile and settings

### API Integration
All API calls are centralized in `src/services/api.js`:
- Automatic JWT token injection
- Token refresh on expiration
- Comprehensive error handling
- Organized by feature (auth, documents, customs, etc.)

## Available Routes

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | Landing | Public landing page |
| `/login` | Landing | Login page |
| `/dashboard` | Dashboard | Main dashboard (protected) |
| `/documents` | Documents | Document management (protected) |
| `/hscode` | HS Code | HS Code lookup (protected) |
| `/customs` | Customs | Customs declarations (protected) |
| `/qa` | Q&A | Document chatbot (protected) |
| `/settings` | Settings | User settings (protected) |

## Theme Customization

The theme is defined in `src/styles/theme.js` with Indian Customs-inspired colors:

```javascript
colors: {
  primary: '#FF6B35',    // Saffron-inspired orange
  secondary: '#138808',  // Deep green
  accent: '#004C99',     // Navy blue
  // ... more colors
}
```

## State Management

### Redux Store
- **authSlice**: User authentication state
- **Redux Persist**: Persists auth state across sessions

### Context Providers
- **AuthContext**: Authentication methods and state
- **DocumentContext**: Document operations and state

## API Endpoints Used

### Authentication
- `POST /react/login` - User login
- `POST /react/signup` - User registration
- `POST /react/logout` - User logout
- `POST /react/refresh-token` - Refresh access token

### Documents
- `POST /react/upload-document` - Upload document
- `POST /react/classify-document` - Classify document type
- `POST /react/extract-data` - Extract document data
- `GET /react/documents` - Get all documents
- `DELETE /react/documents/:id` - Delete document

### Indian Customs
- `POST /react/hscode-lookup` - HS Code lookup
- `POST /react/validate-gst` - Validate GST number
- `POST /react/validate-iec` - Validate IEC number
- `POST /react/generate-customs-declaration` - Generate declaration
- `POST /react/process-bill-of-entry` - Process Bill of Entry
- `POST /react/process-shipping-bill` - Process Shipping Bill

### Q&A
- `POST /react/ask-question` - Ask document question
- `GET /react/chat-history/:id` - Get chat history

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm eject` - Eject from Create React App

### Code Style
- Use functional components with hooks
- Styled Components for all styling
- Centralized API calls in service layer
- Context for global state, Redux for persistence

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Security Features

- JWT-based authentication
- Automatic token refresh
- Secure token storage
- Protected routes
- XSS protection via React
- CORS handling

## Contributing

1. Follow existing component structure
2. Use Styled Components for styling
3. Maintain Indian Customs theme consistency
4. Add proper error handling
5. Test authentication flows

## Troubleshooting

### Common Issues

**Cannot connect to backend:**
- Check `REACT_APP_API_BASE_URL` in `.env`
- Ensure backend is running on correct port
- Check CORS configuration in backend

**Login not working:**
- Clear browser local storage
- Check network tab for API errors
- Verify backend credentials

**Styling issues:**
- Clear browser cache
- Check theme provider is wrapping app
- Verify styled-components installation

## License

MIT License - See LICENSE file

## Support

For issues and questions:
- Check the backend API documentation
- Review the component source code
- Ensure environment variables are set correctly

---

Built with ⚡ for Indian Customs by the Orbisporte Team
