"""
Module 7: Dynamic Exemption & Notification Tracking Service
Purpose: Track customs notifications, parse changes, and auto-update duty rates
Author: OrbisPorté Development Team
Company: SPECTRA AI PTE. LTD., Singapore
Date: 2026-03-03
"""

from typing import Dict, List, Optional, Any, Tuple
from datetime import date, datetime, timedelta
from decimal import Decimal
import logging
import re
import json
from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


class NotificationTrackingService:
    """
    Notification Tracking Service

    Implements PDF Specification Module 7:
    - Notification ingestion from CBIC gazette
    - NLP parsing to extract HSN ranges, rates, dates
    - Conflict detection between notifications
    - Auto-update duty rates
    - Alert system for affected BOEs/users
    """

    # Confidence thresholds
    CONFIDENCE_HIGH = Decimal('0.85')
    CONFIDENCE_MEDIUM = Decimal('0.70')
    CONFIDENCE_LOW = Decimal('0.50')

    def __init__(self, db: Session):
        self.db = db
        self.logger = logger

    # ========================================================================
    # PART 1: NOTIFICATION INGESTION
    # ========================================================================

    def ingest_notification(
        self,
        notification_number: str,
        notification_type: str,
        title: str,
        issue_date: date,
        effective_from: date,
        raw_text: str,
        source_url: Optional[str] = None,
        source_file_path: Optional[str] = None,
        effective_to: Optional[date] = None,
        created_by: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Ingest a new customs notification

        Args:
            notification_number: Official number (e.g., "50/2024-Customs")
            notification_type: Type ('Customs', 'IGST', 'ADD', 'FTA')
            title: Notification title
            issue_date: Date of issue
            effective_from: Date from which changes take effect
            raw_text: Full text of notification (from OCR)
            source_url: URL to official notification
            source_file_path: Path to downloaded PDF
            effective_to: Expiry date (NULL if indefinite)
            created_by: User ID who created this

        Returns:
            Dict with notification_id and status
        """
        try:
            self.logger.info(f"[NOTIFICATION] Ingesting: {notification_number}")

            # Insert notification
            query = text("""
                INSERT INTO customs_notifications (
                    notification_number, notification_type, title,
                    issue_date, effective_from, effective_to,
                    source_url, source_file_path, raw_text,
                    parsed_status, created_by
                ) VALUES (
                    :notification_number, :notification_type, :title,
                    :issue_date, :effective_from, :effective_to,
                    :source_url, :source_file_path, :raw_text,
                    'pending', :created_by
                )
                ON CONFLICT (notification_number)
                DO UPDATE SET
                    raw_text = EXCLUDED.raw_text,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """)

            result = self.db.execute(query, {
                'notification_number': notification_number,
                'notification_type': notification_type,
                'title': title,
                'issue_date': issue_date,
                'effective_from': effective_from,
                'effective_to': effective_to,
                'source_url': source_url,
                'source_file_path': source_file_path,
                'raw_text': raw_text,
                'created_by': created_by
            })

            notification_id = result.scalar()
            self.db.commit()

            self.logger.info(f"[NOTIFICATION] ✅ Ingested notification {notification_number} (ID: {notification_id})")

            return {
                'success': True,
                'notification_id': notification_id,
                'notification_number': notification_number,
                'status': 'ingested'
            }

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"[NOTIFICATION] Failed to ingest: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    # ========================================================================
    # PART 2: NLP PARSING
    # ========================================================================

    def parse_notification(
        self,
        notification_id: int,
        auto_apply: bool = False
    ) -> Dict[str, Any]:
        """
        Parse a notification using NLP to extract HSN codes, rates, and changes

        Args:
            notification_id: ID of notification to parse
            auto_apply: Automatically apply changes if confidence > threshold

        Returns:
            Dict with parsed items and confidence scores
        """
        try:
            self.logger.info(f"[PARSER] Parsing notification ID: {notification_id}")

            # Get notification text
            query = text("""
                SELECT notification_number, raw_text, effective_from
                FROM customs_notifications
                WHERE id = :notification_id
            """)

            result = self.db.execute(query, {'notification_id': notification_id}).fetchone()

            if not result:
                return {'success': False, 'error': 'Notification not found'}

            notification_number, raw_text, effective_from = result

            # Parse the text
            parsed_items = self._extract_rate_changes(raw_text)

            # Save parsed items
            items_saved = []
            for idx, item in enumerate(parsed_items, 1):
                item_id = self._save_notification_item(
                    notification_id=notification_id,
                    item_sequence=idx,
                    item_data=item
                )
                items_saved.append(item_id)

            # Update notification status
            update_query = text("""
                UPDATE customs_notifications
                SET parsed_status = 'parsed',
                    parsed_at = CURRENT_TIMESTAMP
                WHERE id = :notification_id
            """)

            self.db.execute(update_query, {'notification_id': notification_id})
            self.db.commit()

            self.logger.info(f"[PARSER] ✅ Parsed {len(items_saved)} items from {notification_number}")

            # Auto-apply if requested and confidence is high
            if auto_apply:
                self._auto_apply_changes(notification_id, parsed_items)

            return {
                'success': True,
                'notification_id': notification_id,
                'items_count': len(items_saved),
                'items': parsed_items,
                'auto_applied': auto_apply
            }

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"[PARSER] Failed to parse: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }

    def _extract_rate_changes(self, raw_text: str) -> List[Dict[str, Any]]:
        """
        Extract HSN codes and rate changes from notification text using regex

        This is a simplified parser. In production, use:
        - Transformer-based NER (BERT/RoBERTa fine-tuned on customs notifications)
        - spaCy custom entity recognition
        - GPT-4 for complex parsing

        Returns:
            List of extracted items with confidence scores
        """
        items = []

        # Pattern 1: HSN code with rate change
        # Example: "HSN Code 8471 - BCD reduced from 20% to 15%"
        pattern1 = r'HSN\s+Code\s+(\d{4,10}).*?(\w+)\s+(?:reduced|increased|changed)\s+from\s+(\d+(?:\.\d+)?)\s*%\s+to\s+(\d+(?:\.\d+)?)\s*%'

        matches1 = re.finditer(pattern1, raw_text, re.IGNORECASE)

        for match in matches1:
            hsn_code = match.group(1)
            duty_type = match.group(2).upper() if match.group(2).upper() in ['BCD', 'IGST', 'CESS'] else 'BCD'
            old_rate = Decimal(match.group(3))
            new_rate = Decimal(match.group(4))

            items.append({
                'hsn_code_from': hsn_code,
                'duty_type': duty_type,
                'old_rate': float(old_rate),
                'new_rate': float(new_rate),
                'rate_unit': 'percent',
                'hsn_confidence': 0.90,  # High confidence for explicit HSN mention
                'rate_confidence': 0.95,  # High confidence for explicit rate change
                'overall_confidence': 0.92
            })

        # Pattern 2: S. No. with HSN code
        # Example: "S. No. 453 corresponds to HSN Code 8471"
        pattern2 = r'S\.\s*No\.\s*(\d+)\s+corresponds to HSN Code\s+(\d{4,10})'
        matches2 = re.finditer(pattern2, raw_text, re.IGNORECASE)

        serial_to_hsn = {}
        for match in matches2:
            serial_no = match.group(1)
            hsn_code = match.group(2)
            serial_to_hsn[serial_no] = hsn_code

        # Pattern 3: Rate substitution by serial number
        # Example: "for S. No. 453, the entry '20%' shall be substituted with '15%'"
        pattern3 = r'S\.\s*No\.\s*(\d+).*?(\d+(?:\.\d+)?)\s*%.*?substituted with.*?(\d+(?:\.\d+)?)\s*%'
        matches3 = re.finditer(pattern3, raw_text, re.IGNORECASE)

        for match in matches3:
            serial_no = match.group(1)
            old_rate = Decimal(match.group(2))
            new_rate = Decimal(match.group(3))

            if serial_no in serial_to_hsn:
                hsn_code = serial_to_hsn[serial_no]

                items.append({
                    'hsn_code_from': hsn_code,
                    'duty_type': 'BCD',  # Assume BCD if not specified
                    'old_rate': float(old_rate),
                    'new_rate': float(new_rate),
                    'rate_unit': 'percent',
                    'hsn_confidence': 0.88,
                    'rate_confidence': 0.90,
                    'overall_confidence': 0.89
                })

        self.logger.info(f"[PARSER] Extracted {len(items)} rate changes")
        return items

    def _save_notification_item(
        self,
        notification_id: int,
        item_sequence: int,
        item_data: Dict[str, Any]
    ) -> int:
        """Save a parsed notification item to database"""
        query = text("""
            INSERT INTO notification_items (
                notification_id, item_sequence,
                hsn_code_from, hsn_code_to, product_description,
                duty_type, old_rate, new_rate, rate_unit,
                country_of_origin, importer_type, conditions,
                hsn_confidence, rate_confidence, overall_confidence,
                requires_review
            ) VALUES (
                :notification_id, :item_sequence,
                :hsn_code_from, :hsn_code_to, :product_description,
                :duty_type, :old_rate, :new_rate, :rate_unit,
                :country_of_origin, :importer_type, :conditions,
                :hsn_confidence, :rate_confidence, :overall_confidence,
                :requires_review
            )
            RETURNING id
        """)

        result = self.db.execute(query, {
            'notification_id': notification_id,
            'item_sequence': item_sequence,
            'hsn_code_from': item_data.get('hsn_code_from'),
            'hsn_code_to': item_data.get('hsn_code_to'),
            'product_description': item_data.get('product_description'),
            'duty_type': item_data.get('duty_type', 'BCD'),
            'old_rate': item_data.get('old_rate'),
            'new_rate': item_data.get('new_rate'),
            'rate_unit': item_data.get('rate_unit', 'percent'),
            'country_of_origin': item_data.get('country_of_origin'),
            'importer_type': item_data.get('importer_type'),
            'conditions': item_data.get('conditions'),
            'hsn_confidence': item_data.get('hsn_confidence', 0.5),
            'rate_confidence': item_data.get('rate_confidence', 0.5),
            'overall_confidence': item_data.get('overall_confidence', 0.5),
            'requires_review': item_data.get('overall_confidence', 0.5) < float(self.CONFIDENCE_HIGH)
        })

        return result.scalar()

    # ========================================================================
    # PART 3: AUTO-UPDATE DUTY RATES
    # ========================================================================

    def _auto_apply_changes(
        self,
        notification_id: int,
        parsed_items: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Automatically apply parsed rate changes to duty_rates table

        Only applies changes with high confidence (> 0.85)
        """
        applied_count = 0
        skipped_count = 0

        for item in parsed_items:
            if item.get('overall_confidence', 0) >= float(self.CONFIDENCE_HIGH):
                success = self._update_duty_rate(notification_id, item)
                if success:
                    applied_count += 1
                else:
                    skipped_count += 1
            else:
                self.logger.info(f"[AUTO-UPDATE] Skipping item (low confidence: {item.get('overall_confidence')})")
                skipped_count += 1

        self.logger.info(f"[AUTO-UPDATE] Applied {applied_count} changes, skipped {skipped_count}")

        return {
            'applied': applied_count,
            'skipped': skipped_count
        }

    def _update_duty_rate(
        self,
        notification_id: int,
        item: Dict[str, Any]
    ) -> bool:
        """
        Update a duty rate in the duty_rates table

        Returns:
            True if successful, False otherwise
        """
        try:
            hsn_code = item.get('hsn_code_from')
            duty_type = item.get('duty_type')
            new_rate = item.get('new_rate')

            # Get notification effective date
            notif_query = text("""
                SELECT effective_from, notification_number
                FROM customs_notifications
                WHERE id = :notification_id
            """)

            notif_result = self.db.execute(notif_query, {'notification_id': notification_id}).fetchone()
            if not notif_result:
                return False

            effective_from, notification_number = notif_result

            # Expire old rate (set effective_to to day before new rate)
            expire_query = text("""
                UPDATE duty_rates
                SET effective_to = :expire_date
                WHERE hsn_code = :hsn_code
                  AND duty_type = :duty_type
                  AND effective_to IS NULL
            """)

            self.db.execute(expire_query, {
                'hsn_code': hsn_code,
                'duty_type': duty_type,
                'expire_date': effective_from - timedelta(days=1)
            })

            # Insert new rate
            insert_query = text("""
                INSERT INTO duty_rates (
                    hsn_code, duty_type, rate_percent,
                    effective_from, notification_number
                ) VALUES (
                    :hsn_code, :duty_type, :rate_percent,
                    :effective_from, :notification_number
                )
            """)

            self.db.execute(insert_query, {
                'hsn_code': hsn_code,
                'duty_type': duty_type,
                'rate_percent': new_rate,
                'effective_from': effective_from,
                'notification_number': notification_number
            })

            self.db.commit()

            self.logger.info(f"[AUTO-UPDATE] ✅ Updated {duty_type} rate for HSN {hsn_code}: {new_rate}%")
            return True

        except Exception as e:
            self.db.rollback()
            self.logger.error(f"[AUTO-UPDATE] Failed to update rate: {str(e)}")
            return False

    # ========================================================================
    # PART 4: CONFLICT DETECTION
    # ========================================================================

    def detect_conflicts(
        self,
        notification_id: int
    ) -> List[Dict[str, Any]]:
        """
        Detect conflicts between this notification and existing ones

        Returns:
            List of conflicts found
        """
        conflicts = []

        # Get items from this notification
        query = text("""
            SELECT id, hsn_code_from, duty_type, new_rate
            FROM notification_items
            WHERE notification_id = :notification_id
        """)

        items = self.db.execute(query, {'notification_id': notification_id}).fetchall()

        for item_id, hsn_code, duty_type, new_rate in items:
            # Check for conflicting rates in other active notifications
            conflict_query = text("""
                SELECT ni.notification_id, ni.new_rate, n.notification_number
                FROM notification_items ni
                JOIN customs_notifications n ON ni.notification_id = n.id
                WHERE ni.hsn_code_from = :hsn_code
                  AND ni.duty_type = :duty_type
                  AND ni.notification_id != :notification_id
                  AND n.effective_to IS NULL
                  AND ni.new_rate != :new_rate
            """)

            conflict_results = self.db.execute(conflict_query, {
                'hsn_code': hsn_code,
                'duty_type': duty_type,
                'notification_id': notification_id,
                'new_rate': new_rate
            }).fetchall()

            for conflict_notif_id, conflict_rate, conflict_number in conflict_results:
                conflicts.append({
                    'notification_id_1': notification_id,
                    'notification_id_2': conflict_notif_id,
                    'conflict_type': 'rate_mismatch',
                    'hsn_code': hsn_code,
                    'duty_type': duty_type,
                    'description': f"Rate mismatch for HSN {hsn_code} {duty_type}: {new_rate}% vs {conflict_rate}% in {conflict_number}",
                    'severity': 'high'
                })

                # Save conflict to database
                self._save_conflict(conflicts[-1])

        self.logger.info(f"[CONFLICT] Detected {len(conflicts)} conflicts for notification {notification_id}")
        return conflicts

    def _save_conflict(self, conflict: Dict[str, Any]):
        """Save a detected conflict to database"""
        query = text("""
            INSERT INTO notification_conflicts (
                notification_id_1, notification_id_2,
                conflict_type, hsn_code, duty_type,
                description, severity
            ) VALUES (
                :notification_id_1, :notification_id_2,
                :conflict_type, :hsn_code, :duty_type,
                :description, :severity
            )
            ON CONFLICT DO NOTHING
        """)

        self.db.execute(query, conflict)
        self.db.commit()

    # ========================================================================
    # PART 5: USER ALERTS
    # ========================================================================

    def send_alerts(
        self,
        notification_id: int
    ) -> int:
        """
        Send alerts to users whose BOEs are affected by this notification

        Returns:
            Number of alerts sent
        """
        # TODO: Implement alert logic
        # - Find BOEs using affected HSN codes
        # - Find users who created those BOEs
        # - Create alert records
        # - Send email/in-app notifications

        self.logger.info(f"[ALERTS] Sending alerts for notification {notification_id}")
        return 0

    # ========================================================================
    # PART 6: QUERY METHODS
    # ========================================================================

    def get_active_notifications(
        self,
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get list of active notifications"""
        query = text("""
            SELECT * FROM active_notifications
            ORDER BY issue_date DESC
            LIMIT :limit
        """)

        results = self.db.execute(query, {'limit': limit}).fetchall()

        notifications = []
        for row in results:
            notifications.append({
                'id': row[0],
                'notification_number': row[1],
                'notification_type': row[2],
                'title': row[3],
                'issue_date': row[4].isoformat() if row[4] else None,
                'effective_from': row[5].isoformat() if row[5] else None,
                'effective_to': row[6].isoformat() if row[6] else None,
                'parsed_status': row[7],
                'items_count': row[8],
                'avg_confidence': float(row[9]) if row[9] else 0
            })

        return notifications

    def get_recent_rate_changes(
        self,
        days: int = 90,
        hsn_code: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get recent duty rate changes"""
        # Note: The recent_rate_changes view already filters by 90 days
        # We'll apply additional filtering in Python if needed
        query = text("""
            SELECT * FROM recent_rate_changes
            LIMIT 100
        """)

        results = self.db.execute(query).fetchall()

        changes = []
        for row in results:
            changes.append({
                'notification_number': row[0],
                'issue_date': row[1].isoformat() if row[1] else None,
                'effective_from': row[2].isoformat() if row[2] else None,
                'hsn_code_from': row[3],
                'hsn_code_to': row[4],
                'product_description': row[5],
                'duty_type': row[6],
                'old_rate': float(row[7]) if row[7] else None,
                'new_rate': float(row[8]) if row[8] else None,
                'rate_change': float(row[9]) if row[9] else None,
                'change_direction': row[10],
                'overall_confidence': float(row[11]) if row[11] else 0
            })

        return changes


# Convenience function
def ingest_and_parse_notification(
    db: Session,
    notification_number: str,
    notification_type: str,
    title: str,
    issue_date: date,
    effective_from: date,
    raw_text: str,
    auto_apply: bool = False,
    **kwargs
) -> Dict[str, Any]:
    """
    Convenience function to ingest and immediately parse a notification

    Example:
        result = ingest_and_parse_notification(
            db=db,
            notification_number="50/2024-Customs",
            notification_type="Customs",
            title="Amendment to Customs Tariff",
            issue_date=date(2024, 4, 1),
            effective_from=date(2024, 4, 15),
            raw_text="...",
            auto_apply=True
        )
    """
    service = NotificationTrackingService(db)

    # Ingest
    ingest_result = service.ingest_notification(
        notification_number=notification_number,
        notification_type=notification_type,
        title=title,
        issue_date=issue_date,
        effective_from=effective_from,
        raw_text=raw_text,
        **kwargs
    )

    if not ingest_result.get('success'):
        return ingest_result

    notification_id = ingest_result['notification_id']

    # Parse
    parse_result = service.parse_notification(
        notification_id=notification_id,
        auto_apply=auto_apply
    )

    # Detect conflicts
    conflicts = service.detect_conflicts(notification_id)

    return {
        'success': True,
        'notification_id': notification_id,
        'notification_number': notification_number,
        'parsed_items': parse_result.get('items_count', 0),
        'conflicts': len(conflicts),
        'auto_applied': auto_apply
    }
