from datetime import datetime

from sqlalchemy import BigInteger, Boolean, ForeignKey, Integer, String, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base


class School(Base):
    __tablename__ = "schools"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    location_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("locations.id"), nullable=True
    )
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    matriculation: Mapped[int] = mapped_column(Integer, nullable=False)
    offers_breakfast: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    offers_lunch: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    offers_snack: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    location = relationship("Location", back_populates="schools")
    users = relationship("User", back_populates="school")
