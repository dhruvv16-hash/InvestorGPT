export interface Company {
  ticker: string;
  exchange: string;
  country: string;
  currency: string;
  sector?: string;
  industry?: string;
  name: string;
  description?: string;
  website?: string;
}

export interface FinancialMetric {
  metric_name: string;
  value: number | null;
  fiscal_period: string | null;
  source: string;
  confidence: number;
  retrieved_at: string;
}

export interface TechnicalMetric {
  timeframe: string;
  indicator_name: string;
  value: number | null;
  computed_at: string;
}

export interface ValuationMetric {
  model_name: string;
  fair_value: number | null;
  assumptions: Record<string, any>;
  confidence: number;
}

export interface AnalysisDetail {
  analysis_id: string;
  state: string;
  company: Company;
  recommendation: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL" | null;
  confidence: number | null;
  financials: FinancialMetric[];
  technical_data: TechnicalMetric[];
  valuation_results: ValuationMetric[];
}
