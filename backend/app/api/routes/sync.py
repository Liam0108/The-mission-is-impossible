from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
def sync_status() -> dict[str, object]:
    return {
        "enabled": False,
        "message": "Cloud sync interface is reserved for a future release.",
        "supported_scope_fields": ["user_id", "workspace_id"],
    }

