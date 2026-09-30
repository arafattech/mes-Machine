import os
import secrets
import numpy as np
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
from sqlalchemy import text


from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db import get_db
from app.models import FaceId
from app.face import read_image, quality_ok, extract_embedding, best_match
from app.forecast import ForecastRequest, ForecastResponse, run_forecast

TZ = os.getenv("TIMEZONE", "Asia/Dhaka")
EMPLOYEE_TABLE = os.getenv("EMPLOYEE_TABLE", "employees")

def fetch_employee(db, employee_id: int) -> Optional[dict]:
    q = text(f"SELECT * FROM {EMPLOYEE_TABLE} WHERE id = :id LIMIT 1")
    row = db.execute(q, {"id": employee_id}).mappings().first()
    return dict(row) if row else None


def emb_to_bytes(emb: np.ndarray) -> bytes:
    return emb.astype(np.float32).tobytes()

def bytes_to_emb(b: bytes) -> np.ndarray:
    emb = np.frombuffer(b, dtype=np.float32).copy() 
    emb /= (np.linalg.norm(emb) + 1e-12)
    return emb

# def bytes_to_emb(b: bytes) -> np.ndarray:
#     emb = np.frombuffer(b, dtype=np.float32)
#     emb /= (np.linalg.norm(emb) + 1e-12)
#     return emb

def now_iso():
    return datetime.now(ZoneInfo(TZ)).isoformat(timespec="seconds")

app = FastAPI(title="Face Match Microservice", version="1.0.0")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"ok": True, "timestamp": now_iso()}

@app.post("/forecast", response_model=ForecastResponse)
def forecast(request: ForecastRequest):
    return run_forecast(request)

@app.post("/enroll")
async def enroll(
    employee_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await image.read()
    img = read_image(data)

    ok, reason = quality_ok(img)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Image quality failed: {reason}")

    try:
        emb = extract_embedding(img)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    face_id = secrets.token_hex(16)

    row = FaceId(
        employee_id=employee_id,
        face_id=face_id,
        embedding=emb_to_bytes(emb),
    )
    db.add(row)
    db.commit()

    return {"status": "enrolled", "employee_id": employee_id, "face_id": face_id, "timestamp": now_iso()}
@app.post("/match")
async def match(
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    data = await image.read()
    img = read_image(data)

    ok, reason = quality_ok(img)
    if not ok:
        raise HTTPException(status_code=400, detail=f"Image quality failed: {reason}")

    try:
        qemb = extract_embedding(img)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    rows = db.execute(select(FaceId.employee_id, FaceId.face_id, FaceId.embedding)).all()
    candidates = [(emp_id, face_id, bytes_to_emb(b)) for (emp_id, face_id, b) in rows]

    employee_id, face_id, sim = best_match(qemb, candidates)
    ts = now_iso()

    if employee_id is None:
        return {"status": "unknown", "timestamp": ts, "best_similarity": sim}

    employee = fetch_employee(db, int(employee_id))
    if not employee:
        return {
            "status": "matched_but_employee_missing",
            "employee_id": int(employee_id),
            "face_id": face_id,
            "timestamp": ts,
            "similarity": sim,
        }

    return {
        "status": "matched",
        "employee_id": int(employee_id),
        "face_id": face_id,
        "timestamp": ts,
        "similarity": sim,
        "employee": employee,
    }
