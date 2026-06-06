from sqlalchemy import Column, Integer, String, Text, TIMESTAMP
from database import Base
from sqlalchemy.sql import func

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)

    sender = Column(String)

    subject = Column(String)

    description = Column(Text)

    summary = Column(Text)

    urgency = Column(String)

    department = Column(String)

    sentiment = Column(String)

    status = Column(String, default="Open")

    assigned_to = Column(String)

    resolution_note = Column(Text)

    action_taken = Column(Text)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()

    
    )


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(String, primary_key=True, index=True)
    email = Column(String)
    role = Column(String)
    subscription_tier = Column(String, default="free")
    tickets_processed = Column(Integer, default=0)
