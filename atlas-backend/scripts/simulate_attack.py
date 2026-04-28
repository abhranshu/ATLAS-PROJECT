import time
import requests
import sys

# Terminal formatting
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

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
print(f"[{GREEN}+{RESET}] Target acquired! Bypassing edge firewall...")
time.sleep(1)

# Make the request to the backend simulation endpoint
try:
    response = requests.post("http://localhost:8000/api/dashboard/simulate-attack")
    if response.status_code == 200:
        data = response.json()
        print("\n" + "="*50)
        print(f"[{RED}!!!{RESET}] ZERO-DAY EXPLOIT DEPLOYED SUCCESSFULLY")
        print("="*50)
        print(f" >> Target Compromised : {data['target_name']} (ID: {data['target_id']})")
        print(f" >> Trust Score Drop   : CRITICAL ({data['new_score']}/100)")
        print("\n" + "="*50)
        print(f"\n{YELLOW}ACTION REQUIRED: Check your ATLAS SOC Dashboard immediately!{RESET}")
        print("You should now see the new critical threat on the Network Map and Incident Logs.\n")
    else:
        print(f"[{RED}!{RESET}] Attack failed. Ensure your backend server is running on port 8000.")
except Exception as e:
    print(f"[{RED}!{RESET}] Connection error: Is the Atlas backend running? ({e})")
