"""
Kafka client for async document processing events.

Topics
------
  orbis.intake.ingested    – A new document has been accepted from any channel
  orbis.intake.validated   – Validation passed
  orbis.intake.preprocessed – Pre-processing complete
  orbis.intake.classified  – Language + document type detected
  orbis.intake.stored      – Stored in Raw data lake tier

The consumer drives the background pipeline so the HTTP response
returns immediately while processing continues asynchronously.

Falls back to a no-op / local-queue mode when Kafka is unreachable
so development environments don't require a running broker.
"""

import json
import logging
import os
import queue
import threading
from datetime import datetime
from typing import Callable, Dict, Optional

logger = logging.getLogger(__name__)

# ── Kafka availability ────────────────────────────────────────────────────────
try:
    from kafka import KafkaProducer, KafkaConsumer
    from kafka.errors import NoBrokersAvailable, KafkaError
    _KAFKA_AVAILABLE = True
except ImportError:
    _KAFKA_AVAILABLE = False
    logger.warning("kafka-python not installed — Kafka client will use in-process queue fallback.")

KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC_PREFIX = os.getenv("KAFKA_TOPIC_PREFIX", "orbis.intake")

# Canonical topic names
TOPIC_INGESTED     = f"{KAFKA_TOPIC_PREFIX}.ingested"
TOPIC_VALIDATED    = f"{KAFKA_TOPIC_PREFIX}.validated"
TOPIC_PREPROCESSED = f"{KAFKA_TOPIC_PREFIX}.preprocessed"
TOPIC_CLASSIFIED   = f"{KAFKA_TOPIC_PREFIX}.classified"
TOPIC_STORED       = f"{KAFKA_TOPIC_PREFIX}.stored"
TOPIC_FAILED       = f"{KAFKA_TOPIC_PREFIX}.failed"

ALL_TOPICS = [TOPIC_INGESTED, TOPIC_VALIDATED, TOPIC_PREPROCESSED,
              TOPIC_CLASSIFIED, TOPIC_STORED, TOPIC_FAILED]


# ─────────────────────────────────────────────────────────────────────────────
class _LocalQueue:
    """In-process FIFO fallback — subscribers registered via subscribe()."""

    def __init__(self):
        self._q: queue.Queue = queue.Queue()
        self._handlers: Dict[str, list] = {}

    def publish(self, topic: str, message: dict):
        self._q.put((topic, message))
        self._dispatch()

    def subscribe(self, topic: str, handler: Callable):
        self._handlers.setdefault(topic, []).append(handler)

    def _dispatch(self):
        while not self._q.empty():
            topic, message = self._q.get_nowait()
            for handler in self._handlers.get(topic, []):
                try:
                    handler(topic, message)
                except Exception as exc:
                    logger.error("LocalQueue handler error on topic %s: %s", topic, exc)


_local_queue = _LocalQueue()


# ─────────────────────────────────────────────────────────────────────────────
class IntakeProducer:
    """
    Publishes intake pipeline events to Kafka topics.
    Gracefully degrades to the in-process queue when Kafka is unavailable.
    """

    def __init__(self):
        self._producer = self._build_producer()

    def _build_producer(self):
        if not _KAFKA_AVAILABLE:
            return None
        try:
            p = KafkaProducer(
                bootstrap_servers=KAFKA_BOOTSTRAP,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                acks="all",
                retries=3,
                request_timeout_ms=5000,
            )
            logger.info("IntakeProducer: connected to Kafka at %s", KAFKA_BOOTSTRAP)
            return p
        except Exception as exc:
            logger.warning("IntakeProducer: Kafka unavailable (%s) — using local queue.", exc)
            return None

    def _envelope(self, document_id: str, extra: Optional[dict] = None) -> dict:
        msg = {
            "document_id": document_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        if extra:
            msg.update(extra)
        return msg

    def publish(self, topic: str, document_id: str, extra: Optional[dict] = None):
        msg = self._envelope(document_id, extra)
        if self._producer:
            try:
                self._producer.send(topic, key=document_id, value=msg)
                self._producer.flush(timeout=3)
                logger.debug("Kafka published to %s: %s", topic, document_id)
                return
            except Exception as exc:
                logger.error("Kafka publish failed (%s) — falling back to local queue.", exc)
        _local_queue.publish(topic, msg)

    # Convenience methods per pipeline stage
    def emit_ingested(self, document_id: str, channel: str, filename: str):
        self.publish(TOPIC_INGESTED, document_id,
                     {"channel": channel, "filename": filename})

    def emit_validated(self, document_id: str, file_type: str):
        self.publish(TOPIC_VALIDATED, document_id, {"file_type": file_type})

    def emit_preprocessed(self, document_id: str):
        self.publish(TOPIC_PREPROCESSED, document_id)

    def emit_classified(self, document_id: str, doc_type: str, language: str):
        self.publish(TOPIC_CLASSIFIED, document_id,
                     {"doc_type": doc_type, "language": language})

    def emit_stored(self, document_id: str, tier: str, path: str):
        self.publish(TOPIC_STORED, document_id, {"tier": tier, "path": path})

    def emit_failed(self, document_id: str, reason: str, stage: str):
        self.publish(TOPIC_FAILED, document_id, {"reason": reason, "stage": stage})

    def close(self):
        if self._producer:
            self._producer.close()


# ─────────────────────────────────────────────────────────────────────────────
class IntakeConsumer:
    """
    Long-running Kafka consumer that drives the background processing pipeline.
    Runs in a daemon thread; handlers registered with add_handler().
    """

    def __init__(self, group_id: str = "orbis-intake-consumer"):
        self._group_id = group_id
        self._handlers: Dict[str, list] = {}
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._consumer = None

    def add_handler(self, topic: str, handler: Callable):
        """Register a callable(topic, message_dict) for a Kafka topic."""
        self._handlers.setdefault(topic, []).append(handler)
        # Also register with local queue for fallback path
        _local_queue.subscribe(topic, handler)

    def start(self):
        if not _KAFKA_AVAILABLE:
            logger.info("IntakeConsumer: Kafka not available — handlers run via local queue only.")
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="IntakeConsumer")
        self._thread.start()
        logger.info("IntakeConsumer: started (group=%s, topics=%s)", self._group_id, ALL_TOPICS)

    def stop(self):
        self._running = False
        if self._consumer:
            self._consumer.close()

    def _run(self):
        try:
            self._consumer = KafkaConsumer(
                *ALL_TOPICS,
                bootstrap_servers=KAFKA_BOOTSTRAP,
                group_id=self._group_id,
                value_deserializer=lambda b: json.loads(b.decode("utf-8")),
                auto_offset_reset="earliest",
                enable_auto_commit=True,
            )
            for record in self._consumer:
                if not self._running:
                    break
                topic = record.topic
                message = record.value
                for handler in self._handlers.get(topic, []):
                    try:
                        handler(topic, message)
                    except Exception as exc:
                        logger.error("IntakeConsumer handler error [%s]: %s", topic, exc)
        except Exception as exc:
            logger.error("IntakeConsumer crashed: %s", exc)


# ── Module-level singletons ───────────────────────────────────────────────────
_producer: Optional[IntakeProducer] = None
_consumer: Optional[IntakeConsumer] = None


def get_producer() -> IntakeProducer:
    global _producer
    if _producer is None:
        _producer = IntakeProducer()
    return _producer


def get_consumer() -> IntakeConsumer:
    global _consumer
    if _consumer is None:
        _consumer = IntakeConsumer()
    return _consumer
