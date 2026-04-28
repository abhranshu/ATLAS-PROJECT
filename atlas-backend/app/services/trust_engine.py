# ─── Service: Trust Score Engine ──────────────────────────
# Converts the raw Isolation Forest anomaly score into a
# human-readable trust score on the 0–100 scale.
# ──────────────────────────────────────────────────────────


def compute_trust_score(anomaly_score: float) -> float:
    """
    Map an Isolation Forest decision score to a trust score (0–100).

    Isolation Forest scores:
      - ~+0.5  → very normal   → trust ≈ 100
      - ~0.00  → borderline    → trust ≈ 50
      - ~-0.5  → very anomalous→ trust ≈ 0

    We shift by +0.5 to bring [−0.5, +0.5] → [0, 1], then scale × 100.
    The result is clamped strictly to [0, 100].
    """
    normalized = (anomaly_score + 0.5) / 1.0   # → [0, 1] range
    trust = normalized * 100
    return round(max(0.0, min(100.0, trust)), 2)


def score_to_status(trust_score: float) -> str:
    """Convert a numeric trust score to a device status string."""
    if trust_score >= 70:
        return "STABLE"
    if trust_score >= 40:
        return "WARNING"
    if trust_score > 0:
        return "BREACH"
    return "OFFLINE"
