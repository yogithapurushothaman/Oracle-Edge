#!/usr/bin/env python3
"""
ORACLE Edge - Automated Municipal Simulation Runner
Executes an automated 4-stage timed demo loop for presentations and offline testing:
  Stage 1: Normal Baseline (0.0 cm) -> All assets SAFE / Green
  Stage 2: Rain Inflow (1.5 cm) -> Water Rising / Moderate
  Stage 3: Tie-Breaker Surge (Both 3.5 cm) -> H01 scores 95.0 (Priority #1) vs B17 75.0 (Priority #2)
  Stage 4: Critical Emergency (H01 4.2 cm / B17 3.8 cm) -> Red Alert & Hardware Alarm Tone

Usage:
  python backend/simulate.py [--loop] [--delay 6] [--url http://127.0.0.1:8000]
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
        "id": "baseline",
        "title": "STAGE 1: NORMAL BASELINE (0.0 cm)",
        "desc": "Dry ambient conditions. Sensors nominal, emergency response units on standby.",
        "color": GREEN,
        "symbol": "🟢"
    },
    {
        "id": "rain_start",
        "title": "STAGE 2: RAIN INFLOW (1.5 cm)",
        "desc": "Monsoon basin runoff accumulation. Water level begins rising across drainage channels.",
        "color": CYAN,
        "symbol": "💧"
    },
    {
        "id": "equal_surge",
        "title": "STAGE 3: TIE-BREAKER SURGE (Both 3.5 cm)",
        "desc": "Identical flood depth. Triage engine prioritizes Metro Hospital (95) over River Bridge (75).",
        "color": YELLOW,
        "symbol": "🟡"
    },
    {
        "id": "emergency",
        "title": "STAGE 4: CRITICAL EMERGENCY (H01 4.2 cm / B17 3.8 cm)",
        "desc": "Hospital threshold exceeded (>= 4.0 cm). Critical evacuation triggered, buzzer activated.",
        "color": RED,
        "symbol": "🔴"
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
    mode = data.get("device_status", {}).get("mode", "SIMULATION")

    print(f"  {BOLD}Active Mode:{RESET}   {CYAN}{mode} MODE{RESET}")
    print(f"  {BOLD}Top Priority:{RESET}  {YELLOW}{top_prio}{RESET}")
    print(f"  {BOLD}Buzzer Alarm:{RESET}  {RED if buzzer else GREEN}{'TRIGGERED 🚨' if buzzer else 'SILENCED / OFF'}{RESET}")
    print(f"  {BOLD}Directive:{RESET}     {action_text}")

    print(f"\n  {BOLD}Ranked Infrastructure Assets:{RESET}")
    for a in data.get("assets", []):
        aid = a.get("asset_id")
        name = a.get("name")
        depth = a.get("water_level_cm")
        risk = a.get("risk_score")
        rank = a.get("priority_rank", 1)
        status = a.get("status")
        status_color = RED if status == "CRITICAL" else (YELLOW if status == "ELEVATED" else GREEN)
        
        breakdown = a.get("shap_breakdown", {})
        iot_pts = breakdown.get("IoT Depth & Rise Rate", 0)
        infra_pts = breakdown.get("Infrastructure Criticality", 0)
        pop_pts = breakdown.get("Population Exposure", 0)

        print(f"    • Rank #{rank}: {BOLD}{aid} - {name}{RESET}")
        print(f"      Depth: {depth:.1f} cm | Total Risk: {status_color}{risk:.1f}/100 [{status}]{RESET}")
        print(f"      Factors: IoT={iot_pts} pts | Infra={infra_pts} pts | Pop={pop_pts} pts")


def main():
    parser = argparse.ArgumentParser(description="ORACLE Edge Municipal Simulation Demo Runner")
    parser.add_argument("--url", default="http://127.0.0.1:8000", help="FastAPI Backend URL")
    parser.add_argument("--delay", type=float, default=6.0, help="Seconds to pause between stages (default: 6)")
    parser.add_argument("--stage", choices=["baseline", "rain_start", "equal_surge", "emergency"], help="Run single specific stage")
    parser.add_argument("--loop", action="store_true", help="Run simulation loop continuously")
    args = parser.parse_args()

    print(f"\n{BOLD}{CYAN}ORACLE Edge - Space-to-Ground Municipal Decision Intelligence{RESET}")
    print(f"Connecting to Backend: {args.url}\n")

    if args.stage:
        target_info = next((s for s in STAGES if s["id"] == args.stage), STAGES[0])
        run_stage(args.url, target_info)
        return

    iteration = 1
    try:
        while True:
            if args.loop:
                print(f"\n{BOLD}>>> Beginning Demo Loop Cycle #{iteration} <<<{RESET}")
            
            for stage_info in STAGES:
                run_stage(args.url, stage_info)
                print(f"\n{DIM}Pausing {args.delay}s before next municipal stage...{RESET}")
                time.sleep(args.delay)

            if not args.loop:
                print(f"\n{GREEN}{BOLD}✓ 4-Stage Municipal Simulation Cycle Completed Successfully!{RESET}\n")
                break
            iteration += 1
    except KeyboardInterrupt:
        print(f"\n{YELLOW}Simulation runner stopped by operator.{RESET}\n")


if __name__ == "__main__":
    main()
