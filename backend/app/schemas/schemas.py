from pydantic import BaseModel
from typing import Optional, Any

class AnalyzeRequest(BaseModel):
    query: str

class CompanySchema(BaseModel):
    ticker: str
    exchange: str
    country: str
    currency: str
    sector: Optional[str] = None
    industry: Optional[str] = None
    name: str
    description: Optional[str] = None
    website: Optional[str] = None

class AnalyzeResponse(BaseModel):
    analysis_id: str
    state: str
    company: CompanySchema
    poll_url: str

class RecommendationSchema(BaseModel):
    decision: str
    confidence: float
    current_price: float
    fair_value: float
    margin_of_safety: float

class AnalysisDetailResponse(BaseModel):
    analysis_id: str
    state: str
    company: CompanySchema
    recommendation: Optional[str] = None
    confidence: Optional[float] = None
    financials: list[dict[str, Any]]
    technical_data: list[dict[str, Any]]
    valuation_results: list[dict[str, Any]]
    consensus_timeline: Optional[list[dict[str, Any]]] = None


class SearchClickRequest(BaseModel):
    symbol: str
    name: str
    exchange: str
    user_id: str


class RecentSearchResponse(BaseModel):
    symbol: str
    name: str
    exchange: str


class TrendingSearchResponse(BaseModel):
    symbol: str
    count: int

