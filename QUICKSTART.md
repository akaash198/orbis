# Orbisporte Quick Start Guide

Get Orbisporte up and running in minutes!

## Prerequisites

- Node.js (v16 or higher) - [Download](https://nodejs.org/)
- npm (comes with Node.js)
- A code editor (VS Code recommended)

## Step-by-Step Setup

### 1. Navigate to the Project

```bash
cd "/mnt/c/Users/sneha/OneDrive/Desktop/Orbisporte\`"
```

Or on Windows:
```cmd
cd "C:\Users\sneha\OneDrive\Desktop\Orbisporte`"
```

### 2. Install Frontend Dependencies

```bash
cd orbisporte-ui
npm install
```

This will install all required packages (React, Redux, Styled Components, etc.)

### 3. Configure Environment

Create a `.env` file from the example:

```bash
cp .env.example .env
```

On Windows:
```cmd
copy .env.example .env
```

The default configuration should work for local development:
```
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_NAME=Orbisporte
REACT_APP_TAGLINE=AI-Powered Indian Customs Platform
```

### 4. Start the Development Server

```bash
npm start
```

The application will automatically open in your browser at:
**http://localhost:3000**

## What You'll See

### Landing Page
- Beautiful Indian Customs-themed landing page
- Login and Signup forms
- Feature showcase

### After Login/Signup
- **Dashboard**: Overview and statistics
- **Documents**: Upload and manage customs documents
- **HS Code**: Look up Harmonized System codes
- **Customs**: Validate GST/IEC numbers
- **Q&A**: Ask questions about documents
- **Settings**: Manage your profile

## Test Accounts

Since the backend isn't connected yet, the frontend is ready but authentication will need a running backend API.

## Features to Try

### 1. Explore the UI
- Navigate through different panels using the sidebar
- Check the responsive design on mobile
- Try the dark/light themed components

### 2. Test the Forms
- Fill out the GST validation form
- Try the HS Code lookup interface
- Type in the Q&A chatbot

### 3. Check the Theme
- Notice the Indian flag-inspired colors
- Hover over interactive elements
- See the smooth animations

## Next Steps

### Connect to Backend (Coming Soon)

To make the app fully functional, you'll need to:

1. Set up the FastAPI backend
2. Configure PostgreSQL database
3. Set up Redis for caching
4. Connect to an LLM API (OpenAI, etc.)

See the main README.md for backend setup instructions.

### Customize

You can customize the app by editing:

- **Colors**: `src/styles/theme.js`
- **API URL**: `.env` file
- **Branding**: Update logos and text

## Troubleshooting

### Port Already in Use
If port 3000 is taken, you'll be asked to use another port. Type `Y` to accept.

### npm install fails
Try:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Page doesn't load
- Check if the server started successfully
- Look for errors in the terminal
- Clear browser cache and reload

### Styling looks broken
- Make sure all dependencies installed correctly
- Check browser console for errors
- Try `npm run build` and check for errors

## Development Tips

### File Structure
```
orbisporte-ui/
├── src/
│   ├── components/     # All React components
│   ├── contexts/       # AuthContext, DocumentContext
│   ├── services/       # API calls (api.js)
│   ├── store/          # Redux store
│   └── styles/         # Theme and global styles
```

### Making Changes
1. Edit files in `src/`
2. Save the file
3. The page auto-reloads with changes
4. Check console for any errors

### Hot Reload
The dev server supports hot module replacement - changes appear instantly without full page reload!

## Building for Production

When ready to deploy:

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

## Common Tasks

### Add a New Page
1. Create component in `src/components/panels/`
2. Add route in `src/App.js`
3. Add menu item in `src/components/layouts/Sidebar.js`

### Change API URL
Edit `.env` and restart the dev server:
```
REACT_APP_API_BASE_URL=https://your-api.com
```

### Update Theme Colors
Edit `src/styles/theme.js`:
```javascript
colors: {
  primary: '#FF6B35',  // Change this
  // ... more colors
}
```

## Resources

- **React Docs**: https://react.dev
- **Redux Toolkit**: https://redux-toolkit.js.org
- **Styled Components**: https://styled-components.com
- **React Router**: https://reactrouter.com

## Need Help?

- Check the main README.md for detailed documentation
- Look at the component source code for examples
- Ensure all environment variables are set correctly

---

Happy coding! 🚀

Built with ⚡ for Indian Customs
