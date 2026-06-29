import asyncio
import logging
from collections import defaultdict
from typing import Callable, Any, Coroutine

logger = logging.getLogger("investorgpt.event_bus")

class EventBus:
    """Minimal async pub/sub event bus shared across the backend."""

    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable[[Any], Coroutine[Any, Any, None]]]] = defaultdict(list)

    def subscribe(self, event_name: str, handler: Callable[[Any], Coroutine[Any, Any, None]]) -> None:
        self._subscribers[event_name].append(handler)
        logger.debug(f"Subscribed handler to event '{event_name}'")

    async def publish(self, event_name: str, payload: Any) -> None:
        logger.info(f"Publishing event '{event_name}' with payload keys: {list(payload.keys()) if isinstance(payload, dict) else type(payload)}")
        handlers = self._subscribers.get(event_name, [])
        if not handlers:
            return
        
        # Launch handlers in parallel and await completion
        tasks = [handler(payload) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)
