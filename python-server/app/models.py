from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, LargeBinary, BigInteger
from sqlalchemy.sql import func
from sqlalchemy import DateTime

class Base(DeclarativeBase):
    pass

class FaceId(Base):
    __tablename__ = "face_ids"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    employee_id: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    face_id: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    embedding: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[str] = mapped_column(DateTime(timezone=True), server_default=func.now())
