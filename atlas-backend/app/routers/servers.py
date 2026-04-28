from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import require_auth
from app.models.server import Server

router = APIRouter(prefix="/servers", tags=["Servers"])


class ServerCreatePayload(BaseModel):
    name: str = Field(min_length=2, max_length=128)
    location: str | None = Field(default=None, max_length=256)
    x: float = Field(default=50.0, ge=0, le=100)
    y: float = Field(default=50.0, ge=0, le=100)


class ServerUpdatePayload(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=128)
    location: str | None = Field(default=None, max_length=256)
    x: float | None = Field(default=None, ge=0, le=100)
    y: float | None = Field(default=None, ge=0, le=100)


def _serialize(server: Server) -> dict:
    return {
        "id": str(server.id),
        "name": server.name,
        "location": server.location,
        "x": float(server.x),
        "y": float(server.y),
    }


@router.get("")
def list_servers(_: dict = Depends(require_auth), db: Session = Depends(get_db)):
    rows = db.query(Server).order_by(Server.created_at.asc()).all()
    return {"data": [_serialize(row) for row in rows]}


@router.post("", status_code=201)
def create_server(payload: ServerCreatePayload, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    existing = db.query(Server).filter(Server.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=409, detail="Server name already exists")

    row = Server(name=payload.name, location=payload.location, x=payload.x, y=payload.y)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.patch("/{server_id}")
def update_server(server_id: UUID, payload: ServerUpdatePayload, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = db.query(Server).filter(Server.id == server_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Server not found")

    if payload.name is not None:
        duplicate = db.query(Server).filter(Server.name == payload.name, Server.id != row.id).first()
        if duplicate:
            raise HTTPException(status_code=409, detail="Server name already exists")
        row.name = payload.name
    if payload.location is not None:
        row.location = payload.location
    if payload.x is not None:
        row.x = payload.x
    if payload.y is not None:
        row.y = payload.y

    db.commit()
    db.refresh(row)
    return _serialize(row)


@router.delete("/{server_id}")
def delete_server(server_id: UUID, _: dict = Depends(require_auth), db: Session = Depends(get_db)):
    row = db.query(Server).filter(Server.id == server_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Server not found")
    db.delete(row)
    db.commit()
    return {"message": "Server removed"}
