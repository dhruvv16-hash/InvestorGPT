import os
from pathlib import Path
from pydantic import BaseModel, Field

# Determine the root directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent.parent

def load_env_file(env_path: Path) -> dict[str, str]:
    """Manually parse .env file to avoid external dependency issues."""
    env_vars = {}
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip("'\"")
                    env_vars[key] = val
    return env_vars

# Load .env variables into environment if not already set
env_vars = load_env_file(BASE_DIR / ".env")
for k, v in env_vars.items():
    if k not in os.environ:
        os.environ[k] = v

class Settings(BaseModel):
    ENVIRONMENT: str = Field(default="development")
    DATABASE_URL: str = Field(default="sqlite:///./investorgpt.db")
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    CHROMA_PERSIST_DIR: str = Field(default="./data/chroma")
    OLLAMA_HOST: str = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="qwen2.5:14b")
    NEWSAPI_KEY: str = Field(default="")
    ALPHAVANTAGE_KEY: str = Field(default="")
    FRED_API_KEY: str = Field(default="")
    LOG_LEVEL: str = Field(default="INFO")
    CONSENSUS_WEIGHTS_PATH: str = Field(default="./config/consensus_weights.yaml")

    # Default consensus weights (Table 5.5)
    DEFAULT_WEIGHT_FUNDAMENTAL: float = 0.25
    DEFAULT_WEIGHT_VALUATION: float = 0.20
    DEFAULT_WEIGHT_RISK: float = 0.15
    DEFAULT_WEIGHT_TECHNICAL: float = 0.15
    DEFAULT_WEIGHT_NEWS: float = 0.10
    DEFAULT_WEIGHT_MACRO: float = 0.05
    DEFAULT_WEIGHT_SENTIMENT: float = 0.05
    DEFAULT_WEIGHT_COMPETITOR: float = 0.05

db_url = os.environ.get("DATABASE_URL", "sqlite:///./investorgpt.db")
if os.environ.get("VERCEL"):
    import shutil
    src_db = Path(__file__).resolve().parent.parent / "database_seed.db"
    dest_db = Path("/tmp/investorgpt.db")
    if not dest_db.exists() and src_db.exists():
        try:
            shutil.copy(src_db, dest_db)
        except Exception:
            pass
    db_url = "sqlite:////tmp/investorgpt.db"

settings = Settings(
    ENVIRONMENT=os.environ.get("ENVIRONMENT", "development"),
    DATABASE_URL=db_url,
    REDIS_URL=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    CHROMA_PERSIST_DIR=os.environ.get("CHROMA_PERSIST_DIR", "./data/chroma"),
    OLLAMA_HOST=os.environ.get("OLLAMA_HOST", "http://localhost:11434"),
    OLLAMA_MODEL=os.environ.get("OLLAMA_MODEL", "qwen2.5:14b"),
    NEWSAPI_KEY=os.environ.get("NEWSAPI_KEY", ""),
    ALPHAVANTAGE_KEY=os.environ.get("ALPHAVANTAGE_KEY", ""),
    FRED_API_KEY=os.environ.get("FRED_API_KEY", ""),
    LOG_LEVEL=os.environ.get("LOG_LEVEL", "INFO"),
    CONSENSUS_WEIGHTS_PATH=os.environ.get("CONSENSUS_WEIGHTS_PATH", "./config/consensus_weights.yaml"),
)
