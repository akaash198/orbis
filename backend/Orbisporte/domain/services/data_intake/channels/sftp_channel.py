"""
SFTP batch ingestion channel.

Connects to a configured SFTP server, scans a drop folder for new files
(EDI, bulk invoice exports), downloads them, and queues each for the
standard intake pipeline.

Configuration (environment variables)
--------------------------------------
  SFTP_HOST          SFTP hostname
  SFTP_PORT          SSH port (default 22)
  SFTP_USERNAME      SFTP login user
  SFTP_PASSWORD      SFTP password  (use key auth in production)
  SFTP_PRIVATE_KEY   Path to private key file (optional)
  SFTP_DROP_FOLDER   Remote path to scan (default /incoming)
  SFTP_DONE_FOLDER   Remote path to move processed files (default /processed)
"""

import logging
import os
from dataclasses import dataclass
from typing import Iterator, Optional

logger = logging.getLogger(__name__)

SFTP_HOST        = os.getenv("SFTP_HOST", "")
SFTP_PORT        = int(os.getenv("SFTP_PORT", "22"))
SFTP_USERNAME    = os.getenv("SFTP_USERNAME", "")
SFTP_PASSWORD    = os.getenv("SFTP_PASSWORD", "")
SFTP_PRIVATE_KEY = os.getenv("SFTP_PRIVATE_KEY", "")
SFTP_DROP_FOLDER = os.getenv("SFTP_DROP_FOLDER", "/incoming")
SFTP_DONE_FOLDER = os.getenv("SFTP_DONE_FOLDER", "/processed")

try:
    import paramiko
    _PARAMIKO_AVAILABLE = True
except ImportError:
    _PARAMIKO_AVAILABLE = False
    logger.warning("paramiko not installed — SFTP channel will not function.")


@dataclass
class SFTPDocument:
    filename: str
    content: bytes
    remote_path: str
    source_system: str  # SFTP host + folder


class SFTPChannel:
    """
    Polls an SFTP drop folder and yields SFTPDocument objects.

    Usage (in a background task / cron)
    ------------------------------------
        channel = SFTPChannel()
        for doc in channel.fetch_pending():
            intake_service.ingest(doc.content, doc.filename, source_channel="sftp", ...)
    """

    def __init__(self):
        self._ssh: Optional["paramiko.SSHClient"] = None
        self._sftp: Optional["paramiko.SFTPClient"] = None

    def _connect(self) -> bool:
        if not _PARAMIKO_AVAILABLE:
            return False
        if not SFTP_HOST:
            logger.warning("SFTP_HOST not configured.")
            return False
        try:
            self._ssh = paramiko.SSHClient()
            self._ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            connect_kwargs: dict = {
                "hostname": SFTP_HOST,
                "port": SFTP_PORT,
                "username": SFTP_USERNAME,
                "timeout": 30,
            }
            if SFTP_PRIVATE_KEY and os.path.exists(SFTP_PRIVATE_KEY):
                connect_kwargs["key_filename"] = SFTP_PRIVATE_KEY
            else:
                connect_kwargs["password"] = SFTP_PASSWORD

            self._ssh.connect(**connect_kwargs)
            self._sftp = self._ssh.open_sftp()
            logger.info("SFTP connected to %s:%d%s", SFTP_HOST, SFTP_PORT, SFTP_DROP_FOLDER)
            return True
        except Exception as exc:
            logger.error("SFTP connection failed: %s", exc)
            return False

    def _disconnect(self):
        try:
            if self._sftp:
                self._sftp.close()
            if self._ssh:
                self._ssh.close()
        except Exception:
            pass

    def _move_to_done(self, remote_path: str):
        """Move a processed file to the done folder."""
        if self._sftp is None:
            return
        filename = remote_path.split("/")[-1]
        done_path = f"{SFTP_DONE_FOLDER}/{filename}"
        try:
            self._sftp.rename(remote_path, done_path)
            logger.info("SFTP: moved %s → %s", remote_path, done_path)
        except Exception as exc:
            logger.warning("SFTP: could not move file %s: %s", remote_path, exc)

    def fetch_pending(self) -> Iterator[SFTPDocument]:
        """
        Generator that connects, lists drop folder, downloads each file,
        yields it, and moves it to the done folder.
        """
        if not self._connect():
            return

        try:
            file_list = self._sftp.listdir(SFTP_DROP_FOLDER)
            logger.info("SFTP drop folder contains %d file(s).", len(file_list))

            for filename in file_list:
                remote_path = f"{SFTP_DROP_FOLDER}/{filename}"
                try:
                    with self._sftp.open(remote_path, "rb") as f:
                        content = f.read()

                    yield SFTPDocument(
                        filename=filename,
                        content=content,
                        remote_path=remote_path,
                        source_system=f"sftp://{SFTP_HOST}{SFTP_DROP_FOLDER}",
                    )

                    self._move_to_done(remote_path)

                except Exception as exc:
                    logger.error("SFTP: failed to read '%s': %s", filename, exc)

        finally:
            self._disconnect()
