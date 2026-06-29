import sys
from pathlib import Path

# Add backend directory to Python path
sys.path.append(str(Path(__file__).resolve().parent.parent / "backend"))

from app.database.db import engine, Base
# Import models so they are registered with Base metadata
from app.models import models  # noqa: F401

def init_db():
    print("Initializing database...")
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
