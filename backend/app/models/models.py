import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.db import Base

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    exchange: Mapped[str] = mapped_column(String(50), nullable=False)
    country: Mapped[str] = mapped_column(String(60), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    sector: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(String(2000))
    website: Mapped[str | None] = mapped_column(String(255))
    popularity_score: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="company", cascade="all, delete-orphan")

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    analyses: Mapped[list["Analysis"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    session_tokens: Mapped[list["SessionToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")

class SessionToken(Base):
    __tablename__ = "session_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    user: Mapped["User"] = relationship(back_populates="session_tokens")

class Analysis(Base):
    __tablename__ = "analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(String(36), ForeignKey("companies.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    state: Mapped[str] = mapped_column(String(40), default="CREATED")  # CREATED, RESOLVING_COMPANY, FETCHING_DATA, VERIFYING_DATA, NORMALIZING, RUNNING_ENGINES, CONSENSUS, REVIEW, REPORT_GENERATION, COMPLETED, FAILED
    version: Mapped[int] = mapped_column(Integer, default=1)
    recommendation: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)

    company: Mapped["Company"] = relationship(back_populates="analyses")
    user: Mapped["User | None"] = relationship(back_populates="analyses")
    financials: Mapped[list["Financial"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    technical_data: Mapped[list["TechnicalData"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    valuation_results: Mapped[list["ValuationResult"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    reports: Mapped[list["Report"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="analysis", cascade="all, delete-orphan")

class Financial(Base):
    __tablename__ = "financials"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id"), nullable=False)
    metric_name: Mapped[str] = mapped_column(String(100), nullable=False)
    value: Mapped[float | None] = mapped_column(Numeric)
    unit: Mapped[str | None] = mapped_column(String(20))
    fiscal_period: Mapped[str | None] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(100), nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)
    retrieved_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="financials")

class TechnicalData(Base):
    __tablename__ = "technical_data"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id"), nullable=False)
    timeframe: Mapped[str] = mapped_column(String(10), nullable=False)
    indicator_name: Mapped[str] = mapped_column(String(50), nullable=False)
    value: Mapped[float | None] = mapped_column(Numeric)
    computed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="technical_data")

class ValuationResult(Base):
    __tablename__ = "valuation_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id"), nullable=False)
    model_name: Mapped[str] = mapped_column(String(50), nullable=False)
    fair_value: Mapped[float | None] = mapped_column(Numeric)
    assumptions: Mapped[dict] = mapped_column(JSON, nullable=False)
    confidence: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False)

    analysis: Mapped["Analysis"] = relationship(back_populates="valuation_results")

class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id"), nullable=False)
    format: Mapped[str] = mapped_column(String(10), nullable=False)  # pdf, xlsx, pptx, json
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

    analysis: Mapped["Analysis"] = relationship(back_populates="reports")

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    analysis_id: Mapped[str] = mapped_column(String(36), ForeignKey("analyses.id"), nullable=False)
    task_name: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    retries: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime)

    analysis: Mapped["Analysis"] = relationship(back_populates="tasks")


class RecentSearch(Base):
    __tablename__ = "recent_searches"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    exchange: Mapped[str] = mapped_column(String(50), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class SearchClickLog(Base):
    __tablename__ = "search_click_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class FinancialModel(Base):
    __tablename__ = "financial_models"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    assumptions: Mapped[dict] = mapped_column(JSON, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    shares: Mapped[float] = mapped_column(Numeric, nullable=False)
    avg_buy_price: Mapped[float] = mapped_column(Numeric, nullable=False)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class WatchlistTrigger(Base):
    __tablename__ = "watchlist_triggers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)  # PRICE_BELOW, PRICE_ABOVE, DCF_GAP_PCT, RSI_BELOW
    threshold: Mapped[float] = mapped_column(Numeric, nullable=False)
    is_fired: Mapped[bool] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class AIForecast(Base):
    __tablename__ = "ai_forecasts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    quarter: Mapped[str] = mapped_column(String(10), nullable=False)  # e.g., 2026Q3
    forecast_type: Mapped[str] = mapped_column(String(20), nullable=False)  # EPS or REVENUE
    projected_base: Mapped[float] = mapped_column(Numeric, nullable=False)
    projected_bull: Mapped[float] = mapped_column(Numeric, nullable=False)
    projected_bear: Mapped[float] = mapped_column(Numeric, nullable=False)
    confidence_lower: Mapped[float] = mapped_column(Numeric, nullable=False)
    confidence_upper: Mapped[float] = mapped_column(Numeric, nullable=False)
    r_squared: Mapped[float] = mapped_column(Numeric, nullable=False)
    slope: Mapped[float] = mapped_column(Numeric, nullable=False)
    intercept: Mapped[float] = mapped_column(Numeric, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))


class HistoricalValuationRecord(Base):
    __tablename__ = "historical_valuation_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticker: Mapped[str] = mapped_column(String(20), index=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    predicted_revenue: Mapped[float] = mapped_column(Numeric, nullable=True)
    predicted_eps: Mapped[float] = mapped_column(Numeric, nullable=True)
    predicted_fair_value: Mapped[float] = mapped_column(Numeric, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Calibration results (updated retroactively post-earnings)
    reported_revenue: Mapped[float] = mapped_column(Numeric, nullable=True)
    reported_eps: Mapped[float] = mapped_column(Numeric, nullable=True)
    forecast_error_mape: Mapped[float] = mapped_column(Numeric, nullable=True)
    is_calibrated: Mapped[bool] = mapped_column(Integer, default=0) # 0=False, 1=True


