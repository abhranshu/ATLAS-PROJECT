import random
import threading
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from app.mock_data import DEVICES, INCIDENTS

_LOCK = threading.Lock()
_STATE: dict[str, Any] = {
    "cycleId": None,
    "state": "idle",
    "progress": 0,
    "phase": "Idle",
    "targetId": None,
    "targetName": None,
    "attackType": None,
    "newScore": None,
    "cyclesRun": 0,
    "logs": [],
    "startedAt": None,
    "finishedAt": None,
    "error": None,
}

_PHASES = [
    ("Reconnaissance", "scanning open ports and service banners", (4.0, 8.0)),
    ("Exploitation", "injecting malicious payload into control channel", (8.0, 14.0)),
    ("Lateral Movement", "probing neighboring nodes and trust chains", (14.0, 20.0)),
    ("Command & Control", "establishing outbound callback and persistence", (20.0, 26.0)),
]


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_log(level: str, message: str) -> None:
    _STATE["logs"].insert(
        0,
        {
            "id": str(uuid.uuid4()),
            "timestamp": _iso_now(),
            "level": level,
            "message": message,
        },
    )
    _STATE["logs"] = _STATE["logs"][:60]


def _find_target(device_id: str | None) -> dict[str, Any] | None:
    if device_id:
        return next((d for d in DEVICES if d["id"] == device_id), None)
    target = next((d for d in DEVICES if d["status"] == "STABLE"), None)
    return target or (DEVICES[0] if DEVICES else None)


def _simulate_attack(target: dict[str, Any], cycle_id: str, attack_type: str) -> None:
    try:
        with _LOCK:
            _STATE["state"] = "running"
            _STATE["progress"] = 5
            _STATE["phase"] = "Initialization"
            _append_log("INFO", f"Run cycle ({attack_type}) started for {target['name']}")

        for idx, (phase, detail, score_range) in enumerate(_PHASES):
            time.sleep(1.2)
            with _LOCK:
                if _STATE["cycleId"] != cycle_id:
                    return
                score = round(random.uniform(*score_range), 1)
                target["trustScore"] = score
                target["status"] = "WARNING" if score >= 40 else "BREACH"
                _STATE["phase"] = phase
                _STATE["progress"] = min(90, 20 + idx * 20)
                _STATE["newScore"] = score
                _append_log("PHASE", f"{phase}: {detail}")
                _append_log("TRUST", f"{target['name']} trust score dropped to {score}")

        with _LOCK:
            final_score = round(random.uniform(12.0, 22.0), 1)
            target["trustScore"] = final_score
            target["status"] = "BREACH"
            _STATE["newScore"] = final_score
            _STATE["progress"] = 100
            _STATE["phase"] = "Completed"
            _STATE["state"] = "completed"
            _STATE["finishedAt"] = _iso_now()
            _STATE["cyclesRun"] += 1
            _append_log("DETECT", f"Anomaly confirmed on {target['name']}")
            _append_log("CRITICAL", f"{target['name']} marked BREACH at trust score {final_score}")

            INCIDENTS.insert(
                0,
                {
                    "id": str(uuid.uuid4()),
                    "title": f"LIVE ATTACK DETECTED — {target['name']} ({attack_type})",
                    "description": (
                        f"Run cycle ({attack_type}) completed with critical breach indicators for {target['name']} "
                        f"at {target['location']}. Final trust score: {final_score}."
                    ),
                    "severity": "critical",
                    "type": "anomaly",
                    "deviceId": target["id"],
                    "resolved": False,
                    "timestamp": _iso_now(),
                },
            )
    except Exception as exc:  # pragma: no cover - defensive fallback
        with _LOCK:
            _STATE["state"] = "failed"
            _STATE["phase"] = "Failed"
            _STATE["error"] = str(exc)
            _STATE["finishedAt"] = _iso_now()
            _append_log("ERROR", f"Run cycle failed: {exc}")


def start_cycle(device_id: str | None = None, attack_type: str = "Botnet Recruitment") -> dict[str, Any]:
    with _LOCK:
        if _STATE["state"] == "running":
            return dict(_STATE)

        target = _find_target(device_id)
        if not target:
            raise ValueError("No devices available to run cycle")

        cycle_id = str(uuid.uuid4())
        _STATE.update(
            {
                "cycleId": cycle_id,
                "state": "queued",
                "progress": 0,
                "phase": "Queued",
                "targetId": target["id"],
                "targetName": target["name"],
                "attackType": attack_type,
                "newScore": target["trustScore"],
                "startedAt": _iso_now(),
                "finishedAt": None,
                "error": None,
                "logs": [],
            }
        )
        _append_log("INFO", f"Queued {attack_type} cycle for {target['name']}")

        worker = threading.Thread(target=_simulate_attack, args=(target, cycle_id, attack_type), daemon=True)
        worker.start()
        return dict(_STATE)


def get_cycle_status() -> dict[str, Any]:
    with _LOCK:
        return dict(_STATE)
