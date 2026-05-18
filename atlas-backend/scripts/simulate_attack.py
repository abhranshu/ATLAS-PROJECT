"""
ATLAS Virtual IoT Exploit Simulator
─────────────────────────────────────
Simulates a real cyber-attack on the Atlas backend:
  1. Logs in to get a JWT token
  2. POSTs to /api/dashboard/simulate-attack with auth
  3. The backend drops the target device's trust score to BREACH
  4. An Incident + TrustEvent are written to the DB
  5. All caches are busted → NetworkMap & Trust Analysis auto-refresh
"""

import time
import sys
import requests

# ── Terminal colours ───────────────────────────────────────────
GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
CYAN   = '\033[96m'
RESET  = '\033[0m'

BASE_URL = "http://localhost:8000/api"

# Default credentials (change if your setup differs)
USERNAME = "admin"
PASSWORD = "password"

print(f"{RED}")
print(r"""
    ___   ___________    __    _____   __________  ____ 
   /   | /_  __/_  __/   / /   /  _/ | / / ____/ / / /_ |
  / /| |  / /   / /_____/ /    / //  |/ / __/ / / / / | |
 / ___ | / /   / /_____/ /____/ // /|  / /___/ /_/ /  | |
/_/  |_|/_/   /_/     /_____/___/_/ |_/_____/\____/   |_|
                                                         
      --- ATLAS VIRTUAL IOT EXPLOIT SIMULATOR ---
""")
print(f"{RESET}")

print(f"[{YELLOW}*{RESET}] Initialising virtual exploit payload...")
time.sleep(1)
print(f"[{YELLOW}*{RESET}] Scanning local subnet for vulnerable IoT devices...")
time.sleep(1.5)
print(f"[{GREEN}+{RESET}] Target acquired. Bypassing edge firewall...")
time.sleep(0.8)

# ── Step 1: Authenticate ───────────────────────────────────────
print(f"[{YELLOW}*{RESET}] Authenticating with Atlas backend...")
try:
    login_resp = requests.post(
        f"{BASE_URL}/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=5,
    )
    if login_resp.status_code not in (200, 201):
        print(f"[{RED}!{RESET}] Login failed ({login_resp.status_code}). "
              "Check credentials in simulate_attack.py or ensure the backend is running.")
        sys.exit(1)

    token = login_resp.json().get("access_token") or login_resp.json().get("token")
    if not token:
        print(f"[{RED}!{RESET}] No access_token in login response. Response: {login_resp.json()}")
        sys.exit(1)

    print(f"[{GREEN}+{RESET}] Authentication successful.")
except Exception as exc:
    print(f"[{RED}!{RESET}] Cannot reach backend at {BASE_URL}/auth/login — is the server running?")
    print(f"    Error: {exc}")
    sys.exit(1)

time.sleep(0.5)
print(f"[{YELLOW}*{RESET}] Deploying zero-day exploit payload...")
time.sleep(1)

# ── Step 2: Simulate Attack ────────────────────────────────────
attack_type = "Botnet Recruitment"
if len(sys.argv) > 1:
    attack_type = sys.argv[1]

try:
    response = requests.post(
        f"{BASE_URL}/dashboard/simulate-attack",
        json={"attackType": attack_type},
        headers={"Authorization": f"Bearer {token}"},
        timeout=10,
    )

    if response.status_code in (200, 201):
        data = response.json()
        print("\n" + "=" * 55)
        print(f"[{RED}!!!{RESET}] ZERO-DAY EXPLOIT DEPLOYED SUCCESSFULLY")
        print("=" * 55)
        print(f" >> Target Compromised : {data.get('target_name', 'Unknown')}")
        print(f" >> Device ID          : {data.get('target_id', 'N/A')}")
        print(f" >> Old Trust Score    : {data.get('old_score', '?')}")
        print(f" >> New Trust Score    : {RED}{data.get('new_score', '?')}{RESET} / 100")
        print(f" >> Status             : {RED}BREACH{RESET}")
        print(f" >> Attack Type        : {attack_type}")
        print("\n" + "=" * 55)
        print(f"\n{YELLOW}ACTION REQUIRED: Check your ATLAS SOC Dashboard!{RESET}")
        print(f"{CYAN}• Network Map   → device node is now RED + pulsing{RESET}")
        print(f"{CYAN}• Trust Analysis→ fleet avg score dropped{RESET}")
        print(f"{CYAN}• Incident Logs → new CRITICAL incident created{RESET}")
        print(f"{CYAN}• Database      → trust_score & status updated in DB{RESET}\n")
    elif response.status_code == 404:
        print(f"[{RED}!{RESET}] No devices found in database to attack.")
        print("    Seed the database first: python scripts/seed_db.py")
    else:
        print(f"[{RED}!{RESET}] Attack endpoint returned {response.status_code}: {response.text}")

except Exception as exc:
    print(f"[{RED}!{RESET}] Connection error: Is the Atlas backend running on port 8000? ({exc})")
