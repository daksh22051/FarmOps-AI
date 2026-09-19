"""
Async MQTT Client Worker using aiomqtt
"""

import asyncio
from app.config import settings
from app.core.database import AsyncSessionLocal
from app.mqtt.handlers import handle_telemetry_message
from app.core.logging import logger


class MQTTWorker:
    def __init__(self):
        self.is_running = False
        self.task: asyncio.Task | None = None

    async def start(self):
        if not settings.MQTT_ENABLED:
            logger.info("MQTT is disabled in settings. Skipping background worker.")
            return

        self.is_running = True
        self.task = asyncio.create_task(self._run_loop())
        logger.info(f"MQTT background worker initiated for {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}")

    async def stop(self):
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            logger.info("MQTT background worker stopped.")

    async def _run_loop(self):
        try:
            import aiomqtt
        except ImportError:
            logger.error("aiomqtt is not installed. MQTT worker cannot start.")
            return

        reconnect_interval = 5  # seconds
        topic_wildcard = f"{settings.MQTT_TOPIC_PREFIX}/+/telemetry"
        topic_node_wildcard = f"{settings.MQTT_TOPIC_PREFIX}/+/nodes/+/telemetry"

        while self.is_running:
            try:
                logger.info(f"Connecting to MQTT broker at {settings.MQTT_BROKER_HOST}:{settings.MQTT_BROKER_PORT}...")
                client_kwargs = {
                    "hostname": settings.MQTT_BROKER_HOST,
                    "port": settings.MQTT_BROKER_PORT,
                    "identifier": settings.MQTT_CLIENT_ID,
                    "keepalive": settings.MQTT_KEEPALIVE,
                }
                if settings.MQTT_USERNAME:
                    client_kwargs["username"] = settings.MQTT_USERNAME
                    client_kwargs["password"] = settings.MQTT_PASSWORD

                async with aiomqtt.Client(**client_kwargs) as client:
                    await client.subscribe(topic_wildcard)
                    await client.subscribe(topic_node_wildcard)
                    logger.info(f"Subscribed to MQTT topics: {topic_wildcard}, {topic_node_wildcard}")

                    async for message in client.messages:
                        topic_str = str(message.topic)
                        async with AsyncSessionLocal() as session:
                            try:
                                await handle_telemetry_message(session, topic_str, message.payload)
                            except Exception as e:
                                logger.error(f"Error processing MQTT message: {e}")

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"MQTT connection lost or error: {e}. Reconnecting in {reconnect_interval}s...")
                await asyncio.sleep(reconnect_interval)


mqtt_worker = MQTTWorker()
