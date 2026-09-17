#!/usr/bin/env python3
"""
ORACLE Edge - Automated Municipal Simulation Runner
Executes a structured 5-stage demo loop:
  Stage 1: Normal Baseline (0.0 cm) -> All assets SAFE
  Stage 2: Rain Inflow (1.5 cm) -> Rain starts (12 mm/hr), Warning alert
  Stage 3: Tie-Breaker Surge (Both 3.5 cm) -> H01 scores 92 (Rank #1) vs B17 76 (Rank #2)
  Stage 4: Critical Hospital (H01 4.2 cm) -> Critical Red Alert + Buzzer
  Stage 5: Dispatch Completed -> Alpha Dispatched, active monitoring, buzzer silenced

Usage:
  python backend/simulate.py [--loop] [--delay 5] [--stage scenario_3_tiebreaker]
"""

import sys
import time
import argparse
import requests

# ANSI Color formatting
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

STAGES = [
    {
        "id": "scenario_1_normal",
        "title": "STAGE 1: NORMAL BASELINE (0.0 cm)",
        "desc": "H01 = 0.0 cm, B17 = 0.0 cm, Rain = 0 mm/hr, All Normal.",
        "color": GREEN,
        "symbol": "🟢"
    },
    {
        "id": "scenario_2_rain",
        "title": "STAGE 2: RAIN START (1.5 cm)",
        "desc": "Rain starts (12 mm/hr), water levels rise to 1.5 cm (Warning alert).",
        "color": CYAN,
        "symbol": "💧"
    },
    {
        "id": "scenario_3_tiebreaker",
        "title": "STAGE 3: EQUAL SURGE TIE-BREAKER (Both 3.5 cm)",
        "desc": "Both H01 and B17 at exactly 3.5 cm. H01 scores 92 (Rank #1), B17 scores 76 (Rank #2).",
        "color": YELLOW,
        "symbol": "🟡"
    },
    {
        "id": "scenario_4_hospital_critical",
        "title": "STAGE 4: HOSPITAL CRITICAL (H01 4.2 cm)",
        "desc": "H01 rises to 4.2 cm. Critical Red Alert + Buzzer trigger.",
        "color": RED,
        "symbol": "🔴"
    },
    {
        "id": "scenario_5_dispatch_completed",
        "title": "STAGE 5: DISPATCH COMPLETED (Rapid Response Alpha)",
        "desc": "Status updates to 'Alpha Dispatched', mission under active monitoring, buzzer silenced.",
        "color": GREEN,
        "symbol": "🚒"
    }
]


def post_stage(base_url: str, stage_id: str):
    url = f"{base_url.rstrip('/')}/api/v1/simulate/scenario"
    try:
        resp = requests.post(url, json={"stage": stage_id}, timeout=5)
        resp.raise_for_status()
        return resp.json()
    except requests.exceptions.RequestException as e:
        print(f"{RED}[ERROR] Failed to reach simulation API at {url}: {e}{RESET}")
        return None


def run_stage(base_url: str, stage_info: dict):
    print(f"\n{BOLD}{stage_info['color']}══════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{stage_info['symbol']} {stage_info['title']}{RESET}")
    print(f"{DIM}{stage_info['desc']}{RESET}")
    print(f"{BOLD}{stage_info['color']}──────────────────────────────────────────────────────────────────────{RESET}")

    data = post_stage(base_url, stage_info["id"])
    if not data:
        return

    top_prio = data.get("top_priority", "N/A")
    action_text = data.get("recommended_action", "N/A")
    buzzer = data.get("buzzer", False)
    silenced = data.get("buzzer_silenced", False)
    mode = data.get("device_status", {}).get("mode", "SIMULATION")

    print(f"  {BOLD}Active Mode:{RESET}   {CYAN}{mode} MODE{RESET}")
    print(f"  {BOLD}Top Priority:{RESET}  {YELLOW}{top_prio}{RESET}")
    print(f"  {BOLD}Buzzer Alarm:{RESET}  {RED if (buzzer and not silenced) else GREEN}{'TRIGGERED 🚨' if (buzzer and not silenced) else ('SILENCED (En Route)' if silenced else 'OFF')}{RESET}")
    print(f"  {BOLD}Directive:{RESET}     {action_text}")

    print(f"\n  {BOLD}Ranked Infrastructure Assets:{RESET}")
    for a in data.get("assets", []):
        aid = a.get("asset_id")
        name = a.get("name")
        depth = a.get("water_level_cm")
        risk = a.get("risk_score")
        status = a.get("status")
        status_color = RED if status == "CRITICAL" else (YELLOW if status in ["ELEVATED", "HIGH"] else GREEN)

        print(f"    • {BOLD}{aid}{RESET} - {name}")
        print(f"      Depth: {depth:.1f} cm | Total Risk: {risk:.1f}/100 [{status_color}{status}{RESET}]")

    if "explainable_ai" in data:
        print(f"\n  {BOLD}Explainable AI Rationale:{RESET}")
        print(f"    {CYAN}{data['explainable_ai'].get('rationale')}{RESET}")


def main():
    parser = argparse.ArgumentParser(description="ORACLE Edge Demonstration Engine")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="Backend API base URL")
    parser.add_argument("--loop", action="store_true", help="Run stages indefinitely in a loop")
    parser.add_argument("--delay", type=int, default=6, help="Delay in seconds between stages in loop mode")
    parser.add_argument("--stage", default=None, help="Execute a single stage ID directly")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}ORACLE Edge - Municipal Infrastructure Decision Intelligence Platform{RESET}")
    print(f"{DIM}Connecting to Backend: {args.url}{RESET}")

    if args.stage:
        stage_obj = next((s for s in STAGES if s["id"] == args.stage or args.stage in s["id"]), None)
        if not stage_obj:
            print(f"{RED}Unknown stage '{args.stage}'. Options: {[s['id'] for s in STAGES]}{RESET}")
            sys.exit(1)
        run_stage(args.url, stage_obj)
        return

    try:
        while True:
            for s in STAGES:
                run_stage(args.url, s)
                if not args.loop:
                    return
                print(f"\n{DIM}Waiting {args.delay}s before next demonstration stage...{RESET}")
                time.sleep(args.delay)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Simulation runner stopped.{RESET}")


if __name__ == "__main__":
    main()
