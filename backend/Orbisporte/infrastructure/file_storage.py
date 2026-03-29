import os
import hashlib
from pathlib import Path
from datetime import datetime
import shutil


class FileStorage:
    def __init__(self, base_path: str = "./uploads"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(parents=True, exist_ok=True)

    def save_file(self, file_content: bytes, original_filename: str, user_id: int) -> dict:
        """
        Save uploaded file and return file info

        Returns:
            dict with keys: file_path, filename, content_hash, file_type
        """
        # Calculate content hash
        content_hash = hashlib.sha256(file_content).hexdigest()

        # Get file extension
        file_ext = Path(original_filename).suffix.lower()

        # Create user directory
        user_dir = self.base_path / f"user_{user_id}"
        user_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{content_hash[:8]}{file_ext}"
        file_path = user_dir / filename

        # Save file
        with open(file_path, 'wb') as f:
            f.write(file_content)

        return {
            "file_path": str(file_path),
            "filename": filename,
            "original_filename": original_filename,
            "content_hash": content_hash,
            "file_type": file_ext.replace('.', '')
        }

    def get_file_path(self, filename: str, user_id: int) -> Path:
        """Get full path to a file"""
        return self.base_path / f"user_{user_id}" / filename

    def delete_file(self, file_path: str) -> bool:
        """Delete a file"""
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
        except Exception as e:
            print(f"Error deleting file: {e}")
        return False

    def file_exists(self, content_hash: str, user_id: int) -> tuple:
        """
        Check if a file with same content already exists

        Returns:
            (exists: bool, filename: str or None)
        """
        user_dir = self.base_path / f"user_{user_id}"
        if not user_dir.exists():
            return False, None

        for file_path in user_dir.iterdir():
            if content_hash[:8] in file_path.name:
                return True, file_path.name

        return False, None
