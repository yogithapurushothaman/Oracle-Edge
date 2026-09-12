"""
Root entrypoint for testing the mock ESP32 hardware node.
Executes test suite from backend.test_mock_esp32.
"""

import sys
import argparse
from backend.test_mock_esp32 import run_tests

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ORACLE Edge Mock ESP32 Test Script")
    parser.add_argument("--url", type=str, default=None, help="Base URL of running server (e.g. http://localhost:8000)")
    parser.add_argument("--live", action="store_true", help="Test against http://localhost:8000")
    args = parser.parse_args()

    target_url = "http://localhost:8000" if args.live else args.url
    run_tests(target_url)
