from app.orchestration.event_bus import EventBus

# Singleton event bus instance
_event_bus = EventBus()

def get_event_bus() -> EventBus:
    return _event_bus
