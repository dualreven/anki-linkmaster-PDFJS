"""
Screenshot Handler for QWebChannel bridge.

This module provides screenshot saving functionality through QWebChannel,
allowing JavaScript to save screenshot images to local disk.
"""

from __future__ import annotations

from typing import Optional, Callable
import logging
import base64
import hashlib
import json
from pathlib import Path
from datetime import datetime

from src.qt.compat import QObject, pyqtSlot

logger = logging.getLogger(__name__)


class ScreenshotHandler(QObject):
    """Bridge object registered on QWebChannel as `screenshotHandler`.

    Provides methods for saving screenshot images to the local filesystem.
    Screenshots are saved to data/screenshots/ directory with MD5 hash filenames.
    """

    def __init__(self, parent: Optional[QObject] = None, base_dir: Optional[Path] = None):
        """Initialize screenshot handler.

        Args:
            parent: Parent QObject
            base_dir: Base directory for the project (defaults to current working directory)
        """
        super().__init__(parent)

        # Set base directory
        self._base_dir = base_dir or Path.cwd()

        # Create screenshots directory
        self._screenshots_dir = self._base_dir / 'data' / 'screenshots'
        self._screenshots_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"ScreenshotHandler initialized. Screenshots dir: {self._screenshots_dir}")

    @pyqtSlot(str, result=str)
    def saveScreenshot(self, base64Image: str) -> str:
        """Save a base64-encoded screenshot image to local disk.

        Args:
            base64Image: Base64-encoded image data (format: data:image/png;base64,...)

        Returns:
            str: JSON string containing:
                - success (bool): Whether the save was successful
                - path (str): Relative path to the saved image (e.g., /data/screenshots/abc123.png)
                - hash (str): MD5 hash of the image (used as filename)
                - error (str, optional): Error message if save failed

        Example:
            >>> handler.saveScreenshot('data:image/png;base64,iVBORw0KG...')
            '{"success": true, "path": "/data/screenshots/a1b2c3d4.png", "hash": "a1b2c3d4"}'
        """
        logger.info(f"[saveScreenshot] Called with base64 length: {len(base64Image) if base64Image else 0}")
        try:
            # Validate input format
            if not isinstance(base64Image, str):
                raise ValueError("base64Image must be a string")

            if not base64Image.startswith('data:image/'):
                raise ValueError("Invalid image data format (must start with 'data:image/')")

            if 'base64,' not in base64Image:
                raise ValueError("Invalid base64 format (must contain 'base64,')")

            # Extract base64 data (remove data:image/png;base64, prefix)
            base64_data = base64Image.split('base64,', 1)[1]

            # Decode base64 to binary
            image_bytes = base64.b64decode(base64_data)

            # Calculate MD5 hash
            md5_hash = hashlib.md5(image_bytes).hexdigest()

            # Generate filename
            filename = f"{md5_hash}.png"
            file_path = self._screenshots_dir / filename

            # Check if file already exists (deduplication)
            if file_path.exists():
                logger.info(f"Screenshot already exists: {filename}")
                result = {
                    'success': True,
                    'path': f'/data/screenshots/{filename}',
                    'hash': md5_hash,
                    'message': 'File already exists (deduplicated)'
                }
                logger.info(f"[saveScreenshot] Returning (duplicate): {result}")
                return json.dumps(result)

            # Save to file
            with open(file_path, 'wb') as f:
                f.write(image_bytes)

            logger.info(f"Screenshot saved: {filename} ({len(image_bytes)} bytes)")

            result = {
                'success': True,
                'path': f'/data/screenshots/{filename}',
                'hash': md5_hash
            }
            logger.info(f"[saveScreenshot] Returning (success): {result}")
            return json.dumps(result)

        except base64.binascii.Error as e:
            error_msg = f"Base64 decode failed: {str(e)}"
            logger.error(error_msg)
            result = {'success': False, 'error': error_msg}
            logger.info(f"[saveScreenshot] Returning (base64 error): {result}")
            return json.dumps(result)

        except ValueError as e:
            error_msg = f"Validation failed: {str(e)}"
            logger.error(error_msg)
            result = {'success': False, 'error': error_msg}
            logger.info(f"[saveScreenshot] Returning (validation error): {result}")
            return json.dumps(result)

        except OSError as e:
            error_msg = f"File write failed: {str(e)}"
            logger.error(error_msg)
            result = {'success': False, 'error': error_msg}
            logger.info(f"[saveScreenshot] Returning (file error): {result}")
            return json.dumps(result)

        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            logger.error(error_msg)
            result = {'success': False, 'error': error_msg}
            logger.info(f"[saveScreenshot] Returning (unexpected error): {result}")
            return json.dumps(result)

    @pyqtSlot(result=str)
    def getScreenshotsDir(self) -> str:
        """Get the screenshots directory path.

        Returns:
            str: Absolute path to the screenshots directory
        """
        return str(self._screenshots_dir.absolute())

    @pyqtSlot(result=int)
    def getScreenshotCount(self) -> int:
        """Get the number of saved screenshots.

        Returns:
            int: Number of PNG files in the screenshots directory
        """
        try:
            return len(list(self._screenshots_dir.glob('*.png')))
        except Exception as e:
            logger.error(f"Failed to count screenshots: {e}")
            return 0

    @pyqtSlot(str, result=bool)
    def deleteScreenshot(self, hash_or_filename: str) -> bool:
        """Delete a screenshot by hash or filename.

        Args:
            hash_or_filename: MD5 hash or full filename (e.g., 'a1b2c3d4' or 'a1b2c3d4.png')

        Returns:
            bool: True if deleted successfully, False otherwise
        """
        try:
            # Normalize to filename
            filename = hash_or_filename if hash_or_filename.endswith('.png') else f"{hash_or_filename}.png"
            file_path = self._screenshots_dir / filename

            if not file_path.exists():
                logger.warning(f"Screenshot not found: {filename}")
                return False

            file_path.unlink()
            logger.info(f"Screenshot deleted: {filename}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete screenshot {hash_or_filename}: {e}")
            return False

    @pyqtSlot(result=dict)
    def getStorageInfo(self) -> dict:
        """Get storage information about screenshots.

        Returns:
            dict: Information containing:
                - directory (str): Screenshots directory path
                - count (int): Number of screenshots
                - totalSize (int): Total size in bytes
        """
        try:
            screenshots = list(self._screenshots_dir.glob('*.png'))
            total_size = sum(f.stat().st_size for f in screenshots)

            return {
                'directory': str(self._screenshots_dir.absolute()),
                'count': len(screenshots),
                'totalSize': total_size
            }
        except Exception as e:
            logger.error(f"Failed to get storage info: {e}")
            return {
                'directory': str(self._screenshots_dir.absolute()),
                'count': 0,
                'totalSize': 0,
                'error': str(e)
            }
