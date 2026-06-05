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

    action_taken = Column(Text)
    
    resolution_note = Column(Text)

    created_at = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now()

    
    )
