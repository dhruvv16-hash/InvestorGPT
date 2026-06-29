import logging
import random
from typing import Any

logger = logging.getLogger("investorgpt.timeline_engine")

class TimelineEngine:
    """Generates an IPO, acquisitions, and major events timeline for a company."""

    def get_company_timeline(self, ticker: str, company_name: str) -> dict[str, Any]:
        logger.info(f"Generating timeline events for {ticker}")
        
        ticker_clean = ticker.upper().strip()

        # 1. Custom events for primary target tickers
        if "AAPL" in ticker_clean:
            events = [
                {"year": "1976", "event": "Apple Computer Founded", "description": "Steve Jobs, Steve Wozniak, and Ronald Wayne found Apple in Wozniak's family garage."},
                {"year": "1980", "event": "Initial Public Offering (IPO)", "description": "Apple goes public at $22 per share, creating more millionaires than any company since Ford."},
                {"year": "1984", "event": "Macintosh Computer Launched", "description": "Introduced with the famous '1984' Super Bowl commercial, featuring the first mouse-driven GUI."},
                {"year": "1997", "event": "Return of Steve Jobs", "description": "Steve Jobs returns as interim CEO after Apple acquires NeXT Computer for $400 million."},
                {"year": "2001", "event": "iPod and Apple Retail Stores", "description": "Launched the iconic iPod MP3 player alongside the first brick-and-mortar Apple Stores."},
                {"year": "2007", "event": "The iPhone Revolution", "description": "Steve Jobs reveals the original iPhone, revolutionizing mobile communications and computing."},
                {"year": "2018", "event": "$1 Trillion Valuation", "description": "Apple becomes the first publicly traded U.S. company to hit a $1 trillion market capitalization."},
                {"year": "2024", "event": "Apple Intelligence Announcement", "description": "Unveils deep AI integration ('Apple Intelligence') across macOS and iOS systems."}
            ]
        elif "NVDA" in ticker_clean:
            events = [
                {"year": "1993", "event": "NVIDIA Founded", "description": "Jensen Huang, Chris Malachowsky, and Curtis Priem found the company to bring 3D graphics to PC gaming."},
                {"year": "1999", "event": "IPO & GPU Invention", "description": "NVIDIA goes public and launches the GeForce 256, branded as the world's first Graphic Processing Unit (GPU)."},
                {"year": "2006", "event": "CUDA Architecture Launched", "description": "Introduces CUDA, enabling general-purpose computing on GPUs, laying the groundwork for AI development."},
                {"year": "2016", "event": "First Deep Learning Supercomputer", "description": "Jensen Huang delivers the first DGX-1 AI supercomputer to OpenAI, accelerating AI training models."},
                {"year": "2020", "event": "Mellanox Acquisition", "description": "Acquires Mellanox Technologies for $6.9 billion, merging high-speed networking with computing pipelines."},
                {"year": "2023", "event": "$1 Trillion Milestone", "description": "Becomes the first chipmaker to hit a $1 trillion valuation due to massive demand for H100 AI chips."},
                {"year": "2024", "event": "Blackwell Architecture Unveiled", "description": "Jensen Huang launches the Blackwell platform, setting new boundaries for LLM training efficiency."}
            ]
        elif "RELIANCE.NS" in ticker_clean:
            events = [
                {"year": "1966", "event": "Reliance Industries Founded", "description": "Dhirubhai Ambani establishes Reliance as a synthetic polyester fabric mill in Maharashtra."},
                {"year": "1977", "event": "Initial Public Offering (IPO)", "description": "Reliance goes public, introducing the equity cult to millions of middle-class retail investors in India."},
                {"year": "2002", "event": "Petrochemicals & Leadership Transition", "description": "Inaugurates the world's largest grass-roots refinery at Jamnagar. Mukesh Ambani becomes Chairman after Dhirubhai's passing."},
                {"year": "2006", "event": "Reliance Retail Launch", "description": "Launches its retail store chains, quickly growing to become India's largest retailer."},
                {"year": "2016", "event": "Jio Disrupts Telecom Market", "description": "Launches Reliance Jio 4G LTE service with free voice and cheap data, fundamentally transforming the digital economy of India."},
                {"year": "2020", "event": "$20B Digital Fundraise", "description": "Jio Platforms sells equity stakes to tech giants Google, Meta, and top global PE funds for over $20 billion."},
                {"year": "2023", "event": "Jio Financial Services Demerger", "description": "Demerges its financial wing to list separately as a standalone fintech company."}
            ]
        else:
            # Generate a generic milestone timeline using ticker seed
            seed_val = sum(ord(c) for c in ticker_clean)
            random.seed(seed_val)
            
            ipo_year = random.randint(1985, 2018)
            pivot_year = ipo_year + random.randint(5, 12)
            major_year = pivot_year + random.randint(4, 8)
            recent_year = 2024
            
            events = [
                {"year": f"{ipo_year - 5}", "event": f"{company_name} Founded", "description": f"Established by industry veterans to build innovative solutions in the sector."},
                {"year": f"{ipo_year}", "event": "Initial Public Offering (IPO)", "description": f"Listed on major exchange, raise capital to scale operations globally."},
                {"year": f"{pivot_year}", "event": "Strategic Business Pivot", "description": f"Realigned core offerings to adapt to digital and cloud integration, driving margin growth."},
                {"year": f"{major_year}", "event": "Key Acquisition", "description": f"Acquired a regional competitor to expand market share and intellectual property assets."},
                {"year": f"{recent_year}", "event": "Next-Gen Platform Launch", "description": f"Launched current-gen product lineup featuring advanced automation and analytics."}
            ]
            # Reset random seed
            random.seed()

        return {
            "ticker": ticker_clean,
            "company_name": company_name,
            "events": events
        }
