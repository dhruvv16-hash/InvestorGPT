from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database.db import get_db
from app.models.models import PortfolioHolding
from app.providers.market.yahoo_provider import YahooProvider
import logging
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment
import io
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

logger = logging.getLogger("investorgpt.routes_portfolio")
router = APIRouter(prefix="/portfolio", tags=["Portfolio"])

class HoldingAddRequest(BaseModel):
    user_id: str
    ticker: str
    shares: float
    price: float

from app.dependencies import get_current_user
from app.models.models import User

@router.get("")
def get_portfolio(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    holdings = db.query(PortfolioHolding).filter(PortfolioHolding.user_id == current_user.id).all()
    
    total_cost = 0.0
    total_value = 0.0
    
    holdings_data = []
    
    # Simple real-time price fetcher using Yahoo Finance
    provider = YahooProvider()
    
    for h in holdings:
        ticker = h.ticker.upper()
        shares = float(h.shares)
        avg_price = float(h.avg_buy_price)
        cost = avg_price * shares
        total_cost += cost
        
        # Fetch current price dynamically
        current_price = avg_price # default fallback
        try:
            # We can download current price
            import yfinance as yf
            stock = yf.Ticker(ticker)
            history = stock.history(period="1d")
            if not history.empty:
                current_price = float(history["Close"].iloc[-1])
        except Exception as e:
            logger.warning(f"Failed to fetch live price for {ticker}: {e}")
            
        val = current_price * shares
        total_value += val
        
        pnl = val - cost
        pnl_pct = (pnl / cost * 100.0) if cost > 0 else 0.0
        
        holdings_data.append({
            "id": h.id,
            "ticker": ticker,
            "shares": shares,
            "avg_buy_price": avg_price,
            "current_price": current_price,
            "cost": cost,
            "value": val,
            "pnl": pnl,
            "pnl_pct": pnl_pct
        })
        
    # Calculate allocation weights
    for h_data in holdings_data:
        h_data["weight_pct"] = (h_data["value"] / total_value * 100.0) if total_value > 0 else 0.0
        
    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100.0) if total_cost > 0 else 0.0
    
    return {
        "holdings": holdings_data,
        "summary": {
            "total_cost": total_cost,
            "total_value": total_value,
            "total_pnl": total_pnl,
            "total_pnl_pct": total_pnl_pct
        }
    }

@router.post("/add")
def add_holding(
    req: HoldingAddRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ticker = req.ticker.upper().strip()
    if not ticker or req.shares <= 0 or req.price <= 0:
        raise HTTPException(status_code=400, detail="Invalid shares or buy price.")
        
    existing = db.query(PortfolioHolding).filter(
        PortfolioHolding.user_id == current_user.id,
        PortfolioHolding.ticker == ticker
    ).first()
    
    if existing:
        # Accumulate holdings
        old_shares = float(existing.shares)
        old_avg = float(existing.avg_buy_price)
        
        new_shares = old_shares + req.shares
        new_avg = (old_shares * old_avg + req.shares * req.price) / new_shares
        
        existing.shares = new_shares
        existing.avg_buy_price = new_avg
        db.commit()
        db.refresh(existing)
        return {"status": "success", "action": "updated", "id": existing.id}
    else:
        new_h = PortfolioHolding(
            user_id=current_user.id,
            ticker=ticker,
            shares=req.shares,
            avg_buy_price=req.price
        )
        db.add(new_h)
        db.commit()
        db.refresh(new_h)
        return {"status": "success", "action": "created", "id": new_h.id}

@router.delete("/remove/{holding_id}")
def remove_holding(
    holding_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    holding = db.query(PortfolioHolding).filter(
        PortfolioHolding.id == holding_id,
        PortfolioHolding.user_id == current_user.id
    ).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found or not owned by user.")
    db.delete(holding)
    db.commit()
    return {"status": "success"}

@router.get("/export/excel")
def export_portfolio_excel(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = get_portfolio(current_user, db)
    holdings = data["holdings"]
    summary = data["summary"]
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Portfolio Holdings"
    
    # Title
    ws["A1"] = "InvestorGPT Portfolio Holdings Report"
    ws["A1"].font = Font(name="Calibri", size=14, bold=True)
    ws["A2"] = f"User: {current_user.username}"
    ws["A2"].font = Font(name="Calibri", size=10, italic=True)
    
    # Headers
    headers = [
        "Ticker", "Shares", "Avg Entry Price", "Current Price", 
        "Total Cost", "Total Value", "Gain / Loss ($)", "Gain / Loss (%)", "Weight (%)"
    ]
    header_fill = PatternFill(start_color="1F2937", end_color="1F2937", fill_type="solid")
    white_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    bold_font = Font(name="Calibri", size=11, bold=True)
    normal_font = Font(name="Calibri", size=11)
    
    for col_idx, h in enumerate(headers):
        cell = ws.cell(row=4, column=col_idx + 1, value=h)
        cell.font = white_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="center" if col_idx > 0 else "left")
        
    # Data Rows
    row_num = 5
    for h in holdings:
        ws.cell(row=row_num, column=1, value=h["ticker"]).font = bold_font
        ws.cell(row=row_num, column=2, value=h["shares"]).font = normal_font
        
        c3 = ws.cell(row=row_num, column=3, value=h["avg_buy_price"])
        c3.number_format = "$#,##0.00"
        c3.font = normal_font
        
        c4 = ws.cell(row=row_num, column=4, value=h["current_price"])
        c4.number_format = "$#,##0.00"
        c4.font = normal_font
        
        c5 = ws.cell(row=row_num, column=5, value=h["cost"])
        c5.number_format = "$#,##0.00"
        c5.font = normal_font
        
        c6 = ws.cell(row=row_num, column=6, value=h["value"])
        c6.number_format = "$#,##0.00"
        c6.font = normal_font
        
        # Pnl
        c7 = ws.cell(row=row_num, column=7, value=h["pnl"])
        c7.number_format = "$#,##0.00"
        c7.font = normal_font
        
        c8 = ws.cell(row=row_num, column=8, value=h["pnl_pct"] / 100.0)
        c8.number_format = "0.0%"
        c8.font = normal_font
        
        c9 = ws.cell(row=row_num, column=9, value=h["weight_pct"] / 100.0)
        c9.number_format = "0.0%"
        c9.font = normal_font
        
        row_num += 1
        
    # Totals Row
    ws.cell(row=row_num, column=1, value="TOTAL").font = bold_font
    ws.cell(row=row_num, column=2, value="").font = bold_font
    ws.cell(row=row_num, column=3, value="").font = bold_font
    ws.cell(row=row_num, column=4, value="").font = bold_font
    
    t_cost = ws.cell(row=row_num, column=5, value=summary["total_cost"])
    t_cost.number_format = "$#,##0.00"
    t_cost.font = bold_font
    
    t_val = ws.cell(row=row_num, column=6, value=summary["total_value"])
    t_val.number_format = "$#,##0.00"
    t_val.font = bold_font
    
    t_pnl = ws.cell(row=row_num, column=7, value=summary["total_pnl"])
    t_pnl.number_format = "$#,##0.00"
    t_pnl.font = bold_font
    
    t_pnl_pct = ws.cell(row=row_num, column=8, value=summary["total_pnl_pct"] / 100.0)
    t_pnl_pct.number_format = "0.0%"
    t_pnl_pct.font = bold_font
    
    ws.cell(row=row_num, column=9, value=1.0).font = bold_font
    ws.cell(row=row_num, column=9).number_format = "0.0%"
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    headers_resp = {
        "Content-Disposition": "attachment; filename=portfolio_holdings_report.xlsx"
    }
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers_resp
    )

@router.get("/export/pdf")
def export_portfolio_pdf(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = get_portfolio(current_user, db)
    holdings = data["holdings"]
    summary = data["summary"]
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(
        output,
        pagesize=landscape(letter),
        rightMargin=30,
        leftMargin=30,
        topMargin=30,
        bottomMargin=30
    )
    
    story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        name="TitleStyle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        spaceAfter=6,
        textColor=colors.HexColor("#1F2937")
    )
    
    subtitle_style = ParagraphStyle(
        name="SubTitleStyle",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=9,
        spaceAfter=20,
        textColor=colors.HexColor("#4B5563")
    )
    
    story.append(Paragraph("InvestorGPT Portfolio Holdings Report", title_style))
    story.append(Paragraph(f"User: {current_user.username}", subtitle_style))
    story.append(Spacer(1, 10))
    
    # Table data
    table_content = [[
        "Ticker", "Shares", "Avg Entry Price", "Current Price", 
        "Total Cost", "Total Value", "Gain / Loss ($)", "Gain / Loss (%)", "Weight"
    ]]
    
    for h in holdings:
        table_content.append([
            h["ticker"],
            f"{h['shares']:.2f}",
            f"${h['avg_buy_price']:.2f}",
            f"${h['current_price']:.2f}",
            f"${h['cost']:.2f}",
            f"${h['value']:.2f}",
            f"${h['pnl']:.2f}",
            f"{h['pnl_pct']:.1f}%",
            f"{h['weight_pct']:.1f}%"
        ])
        
    # Totals row
    table_content.append([
        "TOTAL",
        "",
        "",
        "",
        f"${summary['total_cost']:.2f}",
        f"${summary['total_value']:.2f}",
        f"${summary['total_pnl']:.2f}",
        f"{summary['total_pnl_pct']:.1f}%",
        "100.0%"
    ])
    
    t = Table(table_content)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#1F2937")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (-1,-1), 'RIGHT'),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 8),
        ('TOPPADDING', (0,0), (-1,0), 8),
        ('ROWBACKGROUNDS', (0,1), (-1,-2), [colors.HexColor("#F9FAFB"), colors.white]),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#E5E7EB")),
        ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor("#F3F4F6")),
        ('TOPPADDING', (0,-1), (-1,-1), 8),
        ('BOTTOMPADDING', (0,-1), (-1,-1), 8),
    ]))
    
    story.append(t)
    doc.build(story)
    output.seek(0)
    
    headers_resp = {
        "Content-Disposition": "attachment; filename=portfolio_holdings_report.pdf"
    }
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers=headers_resp
    )

@router.get("/optimize")
async def optimize_portfolio_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    data = get_portfolio(current_user, db)
    holdings = data.get("holdings", [])
    if not holdings:
        raise HTTPException(status_code=400, detail="Cannot optimize an empty portfolio. Please add holdings first.")
    
    from app.engines.portfolio_optimization import PortfolioOptimizationEngine
    engine = PortfolioOptimizationEngine()
    result = await engine.optimize_portfolio(holdings)
    return result

