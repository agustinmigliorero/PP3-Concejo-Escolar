from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Enum, ForeignKey, String, TIMESTAMP, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config.database import Base

USER_ROLES = ("admin", "gestor", "escuela")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(
        Enum(*USER_ROLES, name="user_role", native_enum=False),
        nullable=False,
        default="escuela",
    )
    school_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("schools.id", ondelete="SET NULL"),
        nullable=True,
    )
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column("password", String(255), nullable=False)
    created_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP, server_default=func.current_timestamp()
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )

    school = relationship("School", back_populates="users")
    refresh_tokens = relationship(
        "RefreshToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )
