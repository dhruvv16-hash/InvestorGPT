from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

router = APIRouter(prefix="/supply-chain", tags=["Supply Chain Graph"])

# Static definition of a global supply chain graph
# Nodes represent companies, Edges represent supplier -> customer relationships
GLOBAL_NODES = {
    "ASML": {"name": "ASML Holding NV", "type": "Equipment Maker", "base_revenue_b": 28.5, "status": "HEALTHY", "disruption_pct": 0.0},
    "TSMC": {"name": "Taiwan Semiconductor Mfg Co.", "type": "Foundry", "base_revenue_b": 75.0, "status": "HEALTHY", "disruption_pct": 0.0},
    "NVDA": {"name": "NVIDIA Corporation", "type": "Chip Designer", "base_revenue_b": 60.9, "status": "HEALTHY", "disruption_pct": 0.0},
    "MU": {"name": "Micron Technology Inc.", "type": "Memory Chips", "base_revenue_b": 15.5, "status": "HEALTHY", "disruption_pct": 0.0},
    "SSNLF": {"name": "Samsung Electronics Co.", "type": "Memory & Foundry", "base_revenue_b": 200.0, "status": "HEALTHY", "disruption_pct": 0.0},
    "AAPL": {"name": "Apple Inc.", "type": "Consumer Electronics", "base_revenue_b": 385.0, "status": "HEALTHY", "disruption_pct": 0.0},
    "MSFT": {"name": "Microsoft Corporation", "type": "Cloud & Software", "base_revenue_b": 220.0, "status": "HEALTHY", "disruption_pct": 0.0},
    "AMZN": {"name": "Amazon.com Inc.", "type": "Cloud & Retail", "base_revenue_b": 570.0, "status": "HEALTHY", "disruption_pct": 0.0}
}

GLOBAL_EDGES = [
    {"source": "ASML", "target": "TSMC", "relationship": "EU Lithography supplier", "criticality": "CRITICAL"},
    {"source": "ASML", "target": "SSNLF", "relationship": "Lithography supplier", "criticality": "HIGH"},
    {"source": "TSMC", "target": "NVDA", "relationship": "GPU Foundry manufacturing", "criticality": "CRITICAL"},
    {"source": "TSMC", "target": "AAPL", "relationship": "A-series / M-series SOC Foundry", "criticality": "CRITICAL"},
    {"source": "NVDA", "target": "MSFT", "relationship": "AI GPU Cloud Accelerators", "criticality": "CRITICAL"},
    {"source": "NVDA", "target": "AMZN", "relationship": "AI GPU Cloud Accelerators", "criticality": "HIGH"},
    {"source": "MU", "target": "NVDA", "relationship": "HBM3e Memory supplier", "criticality": "CRITICAL"},
    {"source": "SSNLF", "target": "NVDA", "relationship": "HBM Memory supplier", "criticality": "HIGH"},
    {"source": "MU", "target": "AAPL", "relationship": "DRAM / NAND supplier", "criticality": "HIGH"},
    {"source": "SSNLF", "target": "AAPL", "relationship": "OLED display / memory supplier", "criticality": "HIGH"},
]

class DisruptionRequest(BaseModel):
    disrupted_node_id: str
    disruption_pct: float # e.g. 50.0 for 50% capacity reduction

@router.get("/{ticker}")
def get_supply_chain(ticker: str):
    ticker_clean = ticker.upper().strip()
    # Normalize some common names to our keys
    key_mapping = {
        "APPLE": "AAPL", "NVIDIA": "NVDA", "MICROSOFT": "MSFT", 
        "AMAZON": "AMZN", "MICRON": "MU", "SAMSUNG": "SSNLF"
    }
    node_id = key_mapping.get(ticker_clean, ticker_clean)
    
    # If the company isn't directly in our predefined database, we generate a template graph centered on it
    if node_id not in GLOBAL_NODES:
        # Create a mock center company and link it to standard suppliers
        local_nodes = {
            node_id: {"name": f"{ticker_clean} Corp.", "type": "Target Company", "base_revenue_b": 10.0, "status": "HEALTHY", "disruption_pct": 0.0},
            "TSMC": GLOBAL_NODES["TSMC"],
            "MU": GLOBAL_NODES["MU"],
            "SSNLF": GLOBAL_NODES["SSNLF"]
        }
        local_edges = [
            {"source": "TSMC", "target": node_id, "relationship": "Silicon manufacturing provider", "criticality": "HIGH"},
            {"source": "MU", "target": node_id, "relationship": "Memory components", "criticality": "MEDIUM"},
            {"source": "SSNLF", "target": node_id, "relationship": "OLED panels & flash memory", "criticality": "MEDIUM"}
        ]
        return {"nodes": local_nodes, "edges": local_edges, "center_node": node_id}

    # For existing nodes, return the full relevant graph
    return {"nodes": GLOBAL_NODES, "edges": GLOBAL_EDGES, "center_node": node_id}

@router.post("/disrupt")
def simulate_disruption(req: DisruptionRequest):
    node_id = req.disrupted_node_id.upper().strip()
    if node_id not in GLOBAL_NODES:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found in global supply graph.")
        
    dis_pct = max(0.0, min(100.0, req.disruption_pct))
    
    # Reset statuses
    nodes = {k: dict(v) for k, v in GLOBAL_NODES.items()}
    for k in nodes:
        nodes[k]["status"] = "HEALTHY"
        nodes[k]["disruption_pct"] = 0.0
        
    # Apply direct disruption
    nodes[node_id]["disruption_pct"] = dis_pct
    nodes[node_id]["status"] = "DISRUPTED" if dis_pct > 0 else "HEALTHY"
    
    # Simple propagation logic:
    # Upstream -> Downstream propagation
    # We do a BFS or topological sweep to cascade the shock downstream
    queue = [node_id]
    visited = set()
    
    while queue:
        curr = queue.pop(0)
        visited.add(curr)
        curr_dis = nodes[curr]["disruption_pct"]
        
        # Find downstream customer nodes
        for edge in GLOBAL_EDGES:
            if edge["source"] == curr:
                target = edge["target"]
                criticality = edge["criticality"]
                
                # Compute shock transmission multiplier based on criticality
                multiplier = 0.5 if criticality == "CRITICAL" else (0.3 if criticality == "HIGH" else 0.15)
                inherited_shock = curr_dis * multiplier
                
                # Accumulate shock on customer node
                nodes[target]["disruption_pct"] = min(95.0, nodes[target]["disruption_pct"] + inherited_shock)
                if nodes[target]["disruption_pct"] > 35.0:
                    nodes[target]["status"] = "CRITICAL_SHOCK"
                elif nodes[target]["disruption_pct"] > 10.0:
                    nodes[target]["status"] = "WARNING_SHOCK"
                
                if target not in visited and target not in queue:
                    queue.append(target)
                    
    # Format updated node objects
    return {
        "nodes": nodes,
        "edges": GLOBAL_EDGES,
        "disruption_source": node_id,
        "applied_disruption_pct": dis_pct
    }
