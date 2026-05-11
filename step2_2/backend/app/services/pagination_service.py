from __future__ import annotations


def paginate(items: list, page: int = 1, page_size: int = 20) -> dict:
    page = max(page, 1)
    page_size = max(page_size, 1)
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "items": items[start:end],
        "page": page,
        "page_size": page_size,
        "total": total,
    }
