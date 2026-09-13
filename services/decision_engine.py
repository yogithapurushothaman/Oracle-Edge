"""Re-export of decision_engine from backend.services"""
import sys
import os

try:
    from backend.services.decision_engine import *
    from backend.services.decision_engine import decision_engine, MultiHazardDecisionEngine
except ImportError:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
    from backend.services.decision_engine import *
    from backend.services.decision_engine import decision_engine, MultiHazardDecisionEngine
