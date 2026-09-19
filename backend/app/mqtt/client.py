"""
Async MQTT Client Worker using aiomqtt
Resilient IoT background consumer with automatic reconnect, wildcard subscriptions, and zero credential leakage.
"""

import asyncio
from typing import Dict, Any, List
from app.config import settings
from app.core.database import get_session_factory
from app.mqtt.handlers import handle_telemetry_message
from app.core.logging import logger


class MQTTWorker:
    def __init__(self):
        self.is_running: bool = False
        self.is_connected: bool = False
        self.task: asyncio.Task | None = None
        self._initial_reconnect_interval: float = 2.0
        self._max_reconnect_interval: float = 30.0
        self._current_reconnect_interval: float = self._initial_reconnect_interval

    async def start(self):
        if not settings.MQTT_ENABLED:
            logger.info("MQTT is disabled in settings. Skipping background worker.")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info(
            f"MQTT background worker initiated for broker {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT} (client_id={settings.MQTT_CLIENT_ID})"
        )

    async def stop(self):
        self.is_running = False
        self.is_connected = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None
            logger.info("MQTT background worker stopped.")

    def get_status(self) -> Dict[str, Any]:
        """Returns safe, sanitized operational status without leaking credentials."""
        return {
            "enabled": settings.MQTT_ENABLED,
            "connected": self.is_connected,
            "broker_host": settings.MQTT_BROKER_HOST,
            "broker_port": settings.MQTT_BROKER_PORT,
            "client_id": settings.MQTT_CLIENT_ID,
            "topic_prefix": settings.MQTT_TOPIC_PREFIX,
        }

    async def _run_loop(self):
        try:
            import aiomqtt
        except ImportError:
            logger.error("aiomqtt is not installed. MQTT worker cannot start.")
            return

        topics_to_subscribe: List[str] = [
            f"{settings.MQTT_TOPIC_PREFIX}/#",
        ]

        while self.is_running:
            try:
                logger.info(
                    f"Connecting to MQTT broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT} (client_id={settings.MQTT_CLIENT_ID})..."
                )
                client_kwargs = {
                    "hostname": settings.MQTT_BROKER_HOST,
                    "port": settings.MQTT_BROKER_PORT,
                    "identifier": settings.MQTT_CLIENT_ID,
                    "keepalive": settings.MQTT_KEEPALIVE,
                }
                if settings.MQTT_USERNAME:
                    client_kwargs["username"] = settings.MQTT_USERNAME
                if settings.MQTT_PASSWORD:
                    client_kwargs["password"] = settings.MQTT_PASSWORD

                async with aiomqtt.Client(**client_kwargs) as client:
                    self.is_connected = True
                    self._current_reconnect_interval = self._initial_reconnect_interval
                    for topic_pattern in topics_to_subscribe:
                        await client.subscribe(topic_pattern)
                    logger.info(f"Subscribed to MQTT topics: {topics_to_subscribe}")

                    async for message in client.messages:
                        topic_str = str(message.topic)
                        session_maker = get_session_factory()
                        async with session_maker() as session:
                            try:
                                await handle_telemetry_message(session, topic_str, message.payload)
                            except Exception as e:
                                logger.error(f"Error handling message on {topic_str}: {e}")

            except asyncio.CancelledError:
                self.is_connected = False
                break
            except Exception as e:
                self.is_connected = False
                logger.warning(
                    f"MQTT connection error: {type(e).__name__} - {e}. Retrying in {self._current_reconnect_interval}s..."
                )
                await asyncio.sleep(self._current_reconnect_interval)
                # Exponential backoff
                self._current_reconnect_interval = min(
                    self._current_reconnect_interval * 1.5, self._max_reconnect_interval
                )


mqtt_worker = MQTTWorker()
