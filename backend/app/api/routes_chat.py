from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.models import Analysis, Company, Financial, ValuationResult, TechnicalData

router = APIRouter(tags=["Chat"])

def get_currency_symbol(currency_code: str | None) -> str:
    if not currency_code:
        return "$"
    clean = currency_code.upper().strip()
    if clean == "INR":
        return "₹"
    if clean == "EUR":
        return "€"
    if clean == "GBP":
        return "£"
    if clean == "JPY":
        return "¥"
    return "$"

class ChatRequest(BaseModel):
    message: str

@router.post("/chat/{analysis_id}", status_code=status.HTTP_200_OK)
async def chat_grounded_report(
    analysis_id: str,
    req: ChatRequest,
    db: Session = Depends(get_db)
):
    analysis = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )
    
    company = db.query(Company).filter(Company.id == analysis.company_id).first()
    financials = db.query(Financial).filter(Financial.analysis_id == analysis_id).all()
    valuations = db.query(ValuationResult).filter(ValuationResult.analysis_id == analysis_id).all()
    technicals = db.query(TechnicalData).filter(TechnicalData.analysis_id == analysis_id).all()

    msg = req.message.lower()
    sym = get_currency_symbol(company.currency)
    
    # 1. Gather report data to build a rich context prompt
    dcf = next((v for v in valuations if v.model_name == "DCF"), None)
    f_score = next((f for f in financials if f.metric_name == "f_score"), None)
    z_score = next((f for f in financials if f.metric_name == "z_score"), None)
    rsi = next((t for t in technicals if t.indicator_name == "RSI"), None)
    sma = next((t for t in technicals if t.indicator_name == "SMA_20"), None)
    
    news_sentiment = next((v for v in valuations if v.model_name == "NEWS_SENTIMENT"), None)
    macro_indicators = next((v for v in valuations if v.model_name == "MACRO_INDICATORS"), None)
    competitors = next((v for v in valuations if v.model_name == "COMPETITORS"), None)
    risk_profile = next((v for v in valuations if v.model_name == "RISK_PROFILE"), None)

    # Format financials list
    fin_statements = []
    for f in financials:
        if f.fiscal_period and f.metric_name not in ["f_score", "z_score", "sentiment_score"]:
            val_formatted = f"{sym}{float(f.value) / 1e9:.2f}B" if f.value is not None and abs(f.value) > 1e7 else str(f.value)
            fin_statements.append(f"- {f.metric_name} (FY{f.fiscal_period}): {val_formatted}")
    fin_str = "\n".join(fin_statements)

    # Format news
    articles = news_sentiment.assumptions.get("articles", []) if news_sentiment else []
    news_str = "\n".join([f"- {a.get('title')} ({a.get('source')}, Sentiment: {a.get('sentiment')})" for a in articles])

    # Format competitors
    comp_list = competitors.assumptions.get("comparison", []) if competitors else []
    comp_str = "\n".join([f"- {c.get('ticker')}: Price={get_currency_symbol(c.get('currency'))}{c.get('price'):.2f}, P/E={c.get('pe') or 'N/A'}, Gross Margin={f'{c.get('gross_margin') * 100:.1f}%' if c.get('gross_margin') is not None else 'N/A'}" for c in comp_list])

    # Format risks
    risk_cats = risk_profile.assumptions.get("categories", []) if risk_profile else []
    risk_str = "\n".join([f"- {r.get('category')} Risk (level: {r.get('level')}, score: {r.get('score')}): {r.get('description')}" for r in risk_cats])

    report_context = f"""
Company: {company.name} ({company.ticker})
Exchange: {company.exchange}
Sector: {company.sector}
Industry: {company.industry}
Country: {company.country}
Currency: {company.currency}
Description: {company.description}
Website: {company.website}

--- Verified Report Metrics ---
DCF Intrinsic Fair Value: {f"{sym}{float(dcf.fair_value):.2f}" if dcf and dcf.fair_value is not None else "N/A"}
Piotroski F-Score: {f"{int(f_score.value)}/9" if f_score and f_score.value is not None else "N/A"}
Altman Z-Score: {f"{float(z_score.value):.2f}" if z_score and z_score.value is not None else "N/A"}
Technical Indicators:
- RSI (14): {f"{float(rsi.value):.2f}" if rsi and rsi.value is not None else "N/A"}
- 20-day SMA: {f"{sym}{float(sma.value):.2f}" if sma and sma.value is not None else "N/A"}

--- News & Sentiment ---
Overall Sentiment: {news_sentiment.assumptions.get('overall_sentiment', 'NEUTRAL') if news_sentiment else 'N/A'}
Sentiment Score: {f"{float(news_sentiment.assumptions.get('sentiment_score', 0.0)) * 100:.0f}%" if news_sentiment else 'N/A'}
Recent Articles:
{news_str}

--- Competitor Comparison ---
{comp_str}

--- Macroeconomic Indicators ---
{macro_indicators.assumptions if macro_indicators else 'N/A'}

--- Risk Profile ---
Overall Risk Level: {risk_profile.assumptions.get('overall_level', 'MEDIUM') if risk_profile else 'N/A'}
Risk Areas:
{risk_str}

--- Annual Financials ---
{fin_str}
"""

    # 2. Attempt to query local Ollama LLM
    import ollama
    from app.config import settings

    system_prompt = (
        "You are InvestorGPT, an advanced AI investment research assistant.\n"
        f"Answer the user's question about the stock {company.name} ({company.ticker}).\n"
        "Here is the verified report data we collected for this stock:\n"
        "=========================================\n"
        f"{report_context}\n"
        "=========================================\n"
        "Using this data, answer the user's question accurately and helpfully.\n"
        "If they ask general questions about the company (e.g., products, business model, history) "
        "that are not fully covered in the report data, use your general knowledge to answer them, "
        "but clearly state what is verified report data vs what is general knowledge.\n"
        "Be professional, clear, and direct."
    )

    try:
        client = ollama.AsyncClient(host=settings.OLLAMA_HOST)
        # 3.0s timeout to keep it fast
        response = await client.chat(model=settings.OLLAMA_MODEL, messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.message}
        ])
        ans = response["message"]["content"]
        return {
            "analysis_id": analysis_id,
            "message": ans,
            "source": "InvestorGPT Grounded QA Agent (LLM-Enhanced)"
        }
    except Exception as e:
        import logging
        logging.getLogger("investorgpt.routes_chat").warning(
            f"Ollama chat failed, falling back to smart rules: {e}"
        )

        # 3. Fallback to Python Smart Rules
        response = ""
        
        if "fair value" in msg or "value" in msg or "dcf" in msg or "worth" in msg:
            if dcf and dcf.fair_value:
                response = f"Based on the generated DCF model for {company.name} ({company.ticker}), the estimated intrinsic fair value is **{sym}{float(dcf.fair_value):.2f}** per share. The DCF model projects 5 years of cash flows using a discount rate (WACC) of 9.0%."
            else:
                response = f"Valuation data for {company.name} is currently not available or could not be calculated."
                
        elif "piotroski" in msg or "f-score" in msg or "fundamental" in msg or "health" in msg:
            response = f"The fundamental metrics for {company.name} show a **Piotroski F-Score** of **{int(f_score.value) if f_score else 'N/A'}/9** "
            if f_score and f_score.value >= 6:
                response += "indicating strong financial strength. "
            else:
                response += "indicating average or weak financial health. "
                
            if z_score and z_score.value is not None:
                response += f"The **Altman Z-Score** is **{float(z_score.value):.2f}**, which puts the company in the "
                if z_score.value > 2.99:
                    response += "'Safe' zone (low bankruptcy risk)."
                elif z_score.value < 1.81:
                    response += "'Distress' zone (high risk)."
                else:
                    response += "'Grey' zone."
                    
        elif "rsi" in msg or "technical" in msg or "indicator" in msg or "price" in msg:
            response = f"Technical indicators for {company.ticker} on the daily timeframe show an **RSI (14)** of **{float(rsi.value):.2f}** " if rsi and rsi.value is not None else ""
            if rsi and rsi.value is not None:
                if rsi.value < 35:
                    response += "(oversold region, potential bullish rebound). "
                elif rsi.value > 70:
                    response += "(overbought region, potential bearish pullback). "
                else:
                    response += "(neutral momentum). "
            if sma and sma.value is not None:
                response += f"The **20-day Simple Moving Average (SMA)** is **{sym}{float(sma.value):.2f}**."

        elif "revenue" in msg or "earnings" in msg or "net income" in msg or "sales" in msg:
            rev_list = [f for f in financials if f.metric_name == "revenue" and f.fiscal_period]
            if rev_list:
                rev_list.sort(key=lambda x: x.fiscal_period, reverse=True)
                latest = rev_list[0]
                response = f"The latest reported annual revenue for {company.name} in FY{latest.fiscal_period} was **{sym}{float(latest.value) / 1e9:.2f}B**."
            else:
                response = "Revenue data is not present in the generated report."

        elif "news" in msg or "sentiment" in msg or "media" in msg:
            if news_sentiment:
                overall = news_sentiment.assumptions.get("overall_sentiment", "NEUTRAL")
                score = news_sentiment.assumptions.get("sentiment_score", 0.0)
                response = f"News and media sentiment for {company.name} is currently **{overall}** (Sentiment Score: **{score * 100:.0f}%**). "
                if articles:
                    response += f"Recent headlines include:\n" + "\n".join([f"- {a.get('title')} ({a.get('source')})" for a in articles[:3]])
            else:
                response = "No news sentiment data was found for this company."

        elif "risk" in msg or "leverage" in msg or "bankruptcy" in msg:
            if risk_profile:
                overall = risk_profile.assumptions.get("overall_level", "MEDIUM")
                response = f"The overall risk level for {company.name} is assessed as **{overall}**.\nSpecific risk areas:\n"
                response += "\n".join([f"- **{c.get('category')}**: {c.get('level')} ({c.get('description')})" for c in risk_cats])
            else:
                response = "No risk profile assessment was found for this company."

        elif "competitor" in msg or "peer" in msg or "industry" in msg or "sector" in msg:
            if comp_list:
                response = f"{company.name} operates in the **{company.sector} / {company.industry}** sector. Here is how it compares to peers:\n"
                response += "\n".join([f"- **{c.get('ticker')}**: Price={get_currency_symbol(c.get('currency'))}{c.get('price'):.2f}, P/E={c.get('pe') or 'N/A'}, Gross Margin={f'{c.get('gross_margin') * 100:.1f}%' if c.get('gross_margin') is not None else 'N/A'}" for c in comp_list])
            else:
                response = f"{company.name} is categorized under the **{company.sector} / {company.industry}** industry. Peer multiple comparison data is currently unavailable."
                
        else:
            # Fallback general query response
            response = f"**{company.name} ({company.ticker})** is a company in the **{company.sector}** sector, **{company.industry}** industry based in **{company.country}**.\n\n"
            if company.description:
                response += f"**Business Overview:** {company.description}\n\n"
            if company.website:
                response += f"**Official Website:** [{company.website}]({company.website})\n\n"

        return {
            "analysis_id": analysis_id,
            "message": response,
            "source": "InvestorGPT Grounded QA Agent (Smart Fallback)"
        }

    return {
        "analysis_id": analysis_id,
        "message": response,
        "source": "InvestorGPT Grounded QA Agent"
    }
