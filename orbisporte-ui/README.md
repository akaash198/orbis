# Orbisporte-ui 🚀

Welcome to the frontend repository of **Orbisporte**, an AI-driven global trade automation and customs platform.

## 📦 Project Overview

Orbisporte-ui is a modern, high-performance web interface built with **React** and **Tailwind CSS**. It provides a seamless experience for managing Indian customs filings, trade documentation, and AI-powered automation.

### Key Technologies 🛠️
- **Framework**: [React](https://reactjs.org/) (v18.2.0)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) for utility-first design.
- **State Management**: Dual-architecture using [Redux Toolkit](https://redux-toolkit.js.org/) for persistent state and [Zustand](https://zustand-demo.pmnd.rs/) for lightweight global state.
- **Data Visualization**: [Recharts](https://recharts.org/) for analytics and trade dashboards.
- **Icons**: [Lucide React](https://lucide.dev/) for a clean, modern UI.
- **HTTP Client**: [Axios](https://axios-http.com/) for API communication.
- **Form Handling**: [React Hook Form](https://react-hook-form.com/) with [Zod](https://zod.dev/) validation.

---

## 🔗 Backend Connectivity Guide

This section outlines **everything** you need to know to successfully connect the Orbisporte React frontend to the backend API. The API logic is centralized in `src/services/api.js`.

### 1. Environment Configuration
The frontend determines the backend URL based on environment variables. 
1. Create a `.env` file at the root of the project.
2. Define the exact API URL:
   ```env
   REACT_APP_API_BASE_URL=http://localhost:8000
   ```
   *(If omitted, the app now falls back to `http://localhost:8000`.)*

### 2. Networking & Fallback Hosts
The `api.js` service is built with high availability in mind. It includes a custom **fallback host handler** (`postWithFallback()`). If a request fails due to `ERR_NETWORK`, the application will automatically retry the request against:
- The configured `REACT_APP_API_BASE_URL`
- `http://localhost:8000`
- `http://127.0.0.1:8000` (if running locally)
- The current window origin (useful for reverse proxies)

### 3. Authentication & Token Management
The frontend uses a secure **Access Token (JWT)** and **Refresh Token** mechanism.

- **Storage**: Tokens are stored explicitly in `localStorage` (`authToken` and `refreshToken`).
- **Axios Interceptors**: 
  - Every outbound request automatically injects the `Authorization: Bearer <token>` header based on the stored `authToken`.
  - If the backend returns a `401 Unauthorized` status, the Axios response interceptor intercepts it, halts the queue, calls `/react/refresh-token` with the `refreshToken`, and re-attempts the original request with the new access token smoothly.
  - If the refresh token is also expired or invalid, it dispatches a window event `tokenExpired`, which logs the user out.

### 4. Core Backend Services Available
All backend services are modularized in `src/services/api.js`. When wiring up UI components, import the specific service module needed:

*   `authService`: Handles `/react/login`, `/react/signup`, `/react/logout`, and `/react/validate-token`.
*   `documentService`: Handles AI document uploads, duplications, standard vs "ULTRA-FAST" data extractions (`/react/extract`, `/react/extract-fast`).
*   `m02Service`: Interacts with the M02 document processing pipeline (`/m02/process`, `/m02/result`).
*   `hsCodeService`: Validates and enhances HS codes based on product descriptions (`/react/hscode`).
*   `customsService`: Generates and exports the final customs declarations (`/customs/generate-declaration`).
*   `chatService` / `qaService`: Manages RAG (Retrieval-Augmented Generation) document chatting and general QA.
*   `dutyService`: Calculates complex customs duties (`/react/duty/calculate`).

---

## 🚀 Getting Started Locally

### 1. Clone the Repository
```bash
git clone https://github.com/akaash198/orbisporte-ui.git
cd orbisporte-ui
```

### 2. Install Dependencies
Ensure you have [Node.js](https://nodejs.org/) installed, then run:
```bash
npm install
```

### 3. Start the Development Server
```bash
# Ensure your .env has REACT_APP_API_BASE_URL setup
npm start
```
The application will be available at `http://localhost:3000`.

---

## 📂 Codebase Architecture

- `src/components/`: Reusable UI components (Buttons, Badges, Modals, etc.).
- `src/services/api.js`: The central powerhouse for Axio configuration and backend communication logic.
- `src/styles/`: Theme definitions and global CSS configurations.
- `src/hooks/`: Custom React hooks for API calls and state logic.
- `src/store/`: Redux and Zustand store definitions.
- `src/auth/`: Authentication flow and secure routing.
- `public/`: Static assets and standard HTML entry point.

---

## 🛠️ Contribution
Feel free to submit issues or pull requests. Please ensure your code follows the existing style and includes proper documentation.

---

**Developed by SPECTRA AI PTE. LTD., Singapore**
