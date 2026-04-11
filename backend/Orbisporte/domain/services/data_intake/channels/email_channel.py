"""
Email ingestion channel.

Connects to an IMAP mailbox, scans for unread messages from registered
sender domains, downloads attachments, and queues them for intake.

Configuration (environment variables)
--------------------------------------
  EMAIL_IMAP_HOST         IMAP server hostname
  EMAIL_IMAP_PORT         IMAP port (default 993 for IMAPS)
  EMAIL_USERNAME          Mailbox login
  EMAIL_PASSWORD          Mailbox password
  EMAIL_FOLDER            Folder to scan (default INBOX)
  EMAIL_ALLOWED_DOMAINS   Comma-separated list of trusted sender domains
                          e.g. "acme.com,supplier.net"
"""

import email
import imaplib
import logging
import os
from dataclasses import dataclass, field
from email.header import decode_header
from typing import Iterator, List, Optional

logger = logging.getLogger(__name__)

IMAP_HOST           = os.getenv("EMAIL_IMAP_HOST", "")
IMAP_PORT           = int(os.getenv("EMAIL_IMAP_PORT", "993"))
EMAIL_USERNAME      = os.getenv("EMAIL_USERNAME", "")
EMAIL_PASSWORD      = os.getenv("EMAIL_PASSWORD", "")
EMAIL_FOLDER        = os.getenv("EMAIL_FOLDER", "INBOX")
_allowed_raw        = os.getenv("EMAIL_ALLOWED_DOMAINS", "")
ALLOWED_DOMAINS: set = {d.strip().lower() for d in _allowed_raw.split(",") if d.strip()}


@dataclass
class EmailAttachment:
    filename: str
    content: bytes
    content_type: str
    sender_address: str
    sender_domain: str
    subject: str
    message_id: str
    source_system: str = "email"


class EmailChannel:
    """
    Polls an IMAP mailbox for unseen messages from registered domains
    and yields EmailAttachment objects for each valid attachment.
    """

    def __init__(self):
        self._conn: Optional[imaplib.IMAP4_SSL] = None

    def _connect(self) -> bool:
        if not IMAP_HOST:
            logger.warning("EMAIL_IMAP_HOST not configured — email channel inactive.")
            return False
        try:
            self._conn = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT)
            self._conn.login(EMAIL_USERNAME, EMAIL_PASSWORD)
            self._conn.select(EMAIL_FOLDER)
            logger.info("Email channel connected to %s:%d (%s)", IMAP_HOST, IMAP_PORT, EMAIL_FOLDER)
            return True
        except Exception as exc:
            logger.error("Email channel connection failed: %s", exc)
            return False

    def _disconnect(self):
        try:
            if self._conn:
                self._conn.logout()
        except Exception:
            pass

    @staticmethod
    def _decode_header_value(raw) -> str:
        parts = decode_header(raw or "")
        decoded = []
        for part, enc in parts:
            if isinstance(part, bytes):
                decoded.append(part.decode(enc or "utf-8", errors="replace"))
            else:
                decoded.append(part)
        return " ".join(decoded)

    def _is_allowed_sender(self, sender: str) -> bool:
        """Check sender domain against the allow-list."""
        if not ALLOWED_DOMAINS:
            return True   # No restriction configured
        domain = sender.split("@")[-1].lower().strip(">").strip()
        return domain in ALLOWED_DOMAINS

    def fetch_pending(self) -> Iterator[EmailAttachment]:
        """
        Yields EmailAttachment for every valid attachment in unseen messages.
        Marks each processed message as SEEN.
        """
        if not self._connect():
            return

        try:
            status, msg_ids = self._conn.search(None, "UNSEEN")
            if status != "OK":
                logger.warning("IMAP SEARCH failed: %s", status)
                return

            ids = msg_ids[0].split()
            logger.info("Email channel: %d unseen message(s).", len(ids))

            for msg_id in ids:
                status, data = self._conn.fetch(msg_id, "(RFC822)")
                if status != "OK" or not data:
                    continue

                raw_email = data[0][1]
                msg = email.message_from_bytes(raw_email)

                sender    = self._decode_header_value(msg.get("From", ""))
                subject   = self._decode_header_value(msg.get("Subject", ""))
                msg_msgid = msg.get("Message-ID", "")

                if not self._is_allowed_sender(sender):
                    logger.warning("Email from non-registered sender '%s' — skipped.", sender)
                    self._conn.store(msg_id, "+FLAGS", "\\Seen")
                    continue

                sender_domain = sender.split("@")[-1].lower().strip(">").strip()

                for part in msg.walk():
                    content_disposition = part.get("Content-Disposition", "")
                    if "attachment" not in content_disposition.lower():
                        continue

                    filename = part.get_filename() or "attachment"
                    filename = self._decode_header_value(filename)
                    payload  = part.get_payload(decode=True)
                    ct       = part.get_content_type() or "application/octet-stream"

                    if not payload:
                        continue

                    yield EmailAttachment(
                        filename=filename,
                        content=payload,
                        content_type=ct,
                        sender_address=sender,
                        sender_domain=sender_domain,
                        subject=subject,
                        message_id=msg_msgid,
                        source_system=f"email://{IMAP_HOST}",
                    )

                # Mark as SEEN after successful processing
                self._conn.store(msg_id, "+FLAGS", "\\Seen")

        finally:
            self._disconnect()
