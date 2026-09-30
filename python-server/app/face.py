import os
import numpy as np
import cv2
from insightface.app import FaceAnalysis

DEFAULT_THRESHOLD = float(os.getenv("FACE_THRESHOLD", "0.45"))

app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
app.prepare(ctx_id=0, det_size=(640, 640))

def read_image(file_bytes: bytes) -> np.ndarray:
    arr = np.frombuffer(file_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Invalid image bytes.")
    return img

def quality_ok(img: np.ndarray) -> tuple[bool, str]:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if brightness < 50:
        return False, "Too dark"
    if brightness > 220:
        return False, "Too bright"
    if sharpness < 40:
        return False, "Too blurry"
    return True, "OK"

def extract_embedding(img: np.ndarray) -> np.ndarray:
    faces = app.get(img)
    if not faces:
        raise ValueError("No face detected.")
    faces = sorted(
        faces,
        key=lambda f: (f.bbox[2]-f.bbox[0])*(f.bbox[3]-f.bbox[1]),
        reverse=True
    )
    emb = faces[0].embedding.astype(np.float32)
    emb /= (np.linalg.norm(emb) + 1e-12)
    return emb

def cosine(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.dot(a, b))

def best_match(qemb: np.ndarray, candidates: list[tuple[str, str, np.ndarray]]):
    best = None
    best_sim = -1.0
    for employee_id, face_id, emb in candidates:
        sim = cosine(qemb, emb)
        if sim > best_sim:
            best_sim = sim
            best = (employee_id, face_id)
    if best is not None and best_sim >= DEFAULT_THRESHOLD:
        return best[0], best[1], best_sim
    return None, None, best_sim
