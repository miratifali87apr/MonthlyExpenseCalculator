def monthly_equivalent(amount: float, frequency: str) -> float:
    """Convert any frequency amount to its monthly equivalent."""
    freq = (frequency or "monthly").lower()
    if freq == "weekly":
        return float(amount) * 52 / 12
    if freq == "fortnightly":
        return float(amount) * 26 / 12
    if freq == "quarterly":
        return float(amount) / 3
    if freq == "yearly":
        return float(amount) / 12
    if freq == "ad_hoc":
        return 0.0
    return float(amount)
