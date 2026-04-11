"""
Main application entry point for Orbisporte API
"""
from Orbisporte.interfaces.api.main import app

# Re-export the app so it can be loaded by uvicorn
__all__ = ['app']
