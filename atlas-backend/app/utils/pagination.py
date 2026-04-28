# ─── Pagination Utility ────────────────────────────────────
# Reusable helper so all list endpoints behave consistently.
# ──────────────────────────────────────────────────────────

from typing import TypeVar, Generic, List
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard envelope returned by all paginated list endpoints."""
    data: List[T]
    total: int
    page: int
    limit: int
    pages: int


def paginate(query, page: int = 1, limit: int = 20):
    """
    Apply OFFSET/LIMIT to a SQLAlchemy query and return
    (items, total_count) tuple.

    Args:
        query:  SQLAlchemy Query object (not yet executed).
        page:   1-indexed current page.
        limit:  Items per page.

    Returns:
        (items: list, total: int)
    """
    page  = max(1, page)
    limit = min(max(1, limit), 100)     # Cap at 100 per page
    total = query.count()
    items = query.offset((page - 1) * limit).limit(limit).all()
    return items, total


def build_paginated_response(items: list, total: int, page: int, limit: int, schema) -> dict:
    """Serialise a page of SQLAlchemy rows into a PaginatedResponse-shaped dict."""
    pages = max(1, -(-total // limit))  # ceiling division
    return {
        "data":  [schema.model_validate(item) for item in items],
        "total": total,
        "page":  page,
        "limit": limit,
        "pages": pages,
    }
