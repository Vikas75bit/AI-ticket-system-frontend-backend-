import os
import json
from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
from groq import Groq
import chromadb
from dotenv import load_dotenv
from worker import celery_app

from sqlalchemy import func
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from database import SessionLocal
import models

from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent

# Load local .env configurations from this app folder, regardless of where uvicorn is run.
load_dotenv(BASE_DIR / ".env")


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "https://ai-ticket-system-frontend-backend.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],  # 👈 This asterisk covers GET, POST, PATCH, and DELETE safely!
    allow_headers=["*"],
)

# Database Session Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 1. Initialize Clients securely via Environment Variables
chroma_client = chromadb.Client()

def get_groq_client() -> Groq:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Add it to ai-ticket-api/.env or set it in your terminal before starting uvicorn."
        )
    return Groq(api_key=api_key)

# 2. Setup Vector Database (RAG Layer)
collection = chroma_client.get_or_create_collection(name="ticket_knowledge")

# Seed the vector database with company policy on startup
with open(BASE_DIR / "company_policy.txt", "r") as f:
    policy_text = f.read()

chunks = [chunk.strip() for chunk in policy_text.split("\n\n") if chunk.strip()]
collection.add(
    documents=chunks,
    ids=[f"policy_chunk_{i}" for i in range(len(chunks))]
)

# 3. Define the Incoming Request Schema
class Ticket(BaseModel):
    sender: str
    subject: str
    message: str

class TicketCreate(BaseModel):
    sender: str
    subject: str
    summary: str

class OverrideRequest(BaseModel):
    manual_action: str

# 4. Define Agentic Execution Tools (The Python "Hands")
def lookup_refund_eligibility(user_email: str) -> str:
    """Looks up if a user is eligible for a refund based on internal corporate tracking logs."""
    if "btech" in user_email.lower() or "vikas" in user_email.lower():
        return "DENIED: System logs verify that B.Tech training keys have already been activated for this account."
    return "APPROVED: Account within the standard 14-day window. No keys activated."

def trigger_account_audit(user_email: str, issue_description: str) -> str:
    """Flags a user account for a manual backend system technical or security audit."""
    return f"SUCCESS: Technical incident token generated for {user_email}. Issue registered: '{issue_description}'."

# 5. Define the Groq Tool Schemas (The Blueprint for Llama 3)
tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "lookup_refund_eligibility",
            "description": "Use this tool when a customer explicitly requests a refund or money back for a purchase.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {
                        "type": "string",
                        "description": "The email address of the customer making the request."
                    }
                },
                "required": ["user_email"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "trigger_account_audit",
            "description": "Use this tool ONLY when a customer reports server crashes, database errors, timeouts, or potential security vulnerabilities.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_email": {
                        "type": "string",
                        "description": "The customer email address."
                    },
                    "issue_description": {
                        "type": "string",
                        "description": "A brief technical summary of the system failure or crash."
                    }
                },
                "required": ["user_email", "issue_description"]
            }
        }
    }
]

@app.get("/")
def home():
    return {"message": "AI Agentic RAG Ticket API Running"}

@app.post("/analyze-ticket", status_code=202)
def analyze_ticket_async(ticket: Ticket):
    """
    Accepts the customer ticket data instantly, offloads it to the 
    Redis queue for Celery to process, and returns a tracking token immediately.
    """
    try:
        # Convert our Pydantic model into a serializable standard Python dictionary
        ticket_payload = {
            "sender": ticket.sender,
            "subject": ticket.subject,
            "message": ticket.message
        }
        
        # OBLITERATE THE BOTTLENECK: Offload the task to Redis using Celery's .delay() method
        # This execution takes less than 5 milliseconds!
        task = celery_app.send_task("tasks.process_ticket_async", args=[ticket_payload])
        
        # Hand back an instant 202 Accepted response along with the tracking identifier
        return {
            "status": "Queued",
            "message": "Ticket successfully offloaded to background execution queue.",
            "task_id": task.id
        }
        
    except Exception as e:
        return {
            "status": "Queue Error",
            "message": f"Failed to push task into background broker: {str(e)}"
        }

@app.get("/tickets")
def get_tickets(db: Session = Depends(get_db)):
    """Fetches every single support ticket record resting inside the cloud database."""
    tickets = db.query(models.Ticket).order_by(models.Ticket.created_at.desc()).all()
    return tickets

@app.post("/tickets")
def create_ticket(ticket: TicketCreate, db: Session = Depends(get_db)):
    """Creates a customer-submitted ticket synchronously so it is visible after login refreshes."""
    normalized_sender = ticket.sender.strip().lower()
    db_ticket = models.Ticket(
        sender=normalized_sender,
        subject=ticket.subject.strip(),
        summary=ticket.summary.strip(),
        urgency="Pending",
        department="Support",
        sentiment="Pending",
        action_taken="Ticket submitted. Awaiting review.",
    )

    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

@app.get("/tickets/user/{user_email}")
def get_user_tickets(user_email: str, db: Session = Depends(get_db)):
    """Fetches tickets submitted by a single user email."""
    normalized_email = user_email.strip().lower()
    tickets = (
        db.query(models.Ticket)
        .filter(func.lower(models.Ticket.sender) == normalized_email)
        .order_by(models.Ticket.created_at.desc())
        .all()
    )
    return tickets


@app.get("/tickets/high")
def get_high_priority_tickets(db: Session = Depends(get_db)):
    """Fetches ONLY the tickets categorized under 'High' urgency status."""
    tickets = db.query(models.Ticket).filter(models.Ticket.urgency == "High").all()
    return tickets

@app.get("/tickets/billing")
def get_billing_tickets(db: Session = Depends(get_db)):
    """Fetches ONLY the tickets routed to the Billing department."""
    tickets = db.query(models.Ticket).filter(models.Ticket.department == "Billing").all()
    return tickets

@app.get("/analytics")
def get_analytics(db: Session = Depends(get_db)):
    """Computes live aggregated system KPIs across the cloud database cluster."""
    total_count = db.query(models.Ticket).count()
    
    high_priority_count = db.query(models.Ticket).filter(
        models.Ticket.urgency == "High"
    ).count()

    return {
        "total_tickets": total_count,
        "high_priority_tickets": high_priority_count,
        "system_status": "Healthy" if total_count > 0 else "Empty"
    }

@app.patch("/tickets/{ticket_id}/override")
def override_ticket_action(ticket_id: int, payload: OverrideRequest, db: Session = Depends(get_db)):
    """
    Locates an existing ticket row in Supabase by its unique ID
    and overwrites the autonomous AI text with a compliance-stamped human override directive.
    """
    # Query the PostgreSQL table for that specific record index
    db_ticket = db.query(models.Ticket).filter(models.Ticket.id == ticket_id).first()
    
    # If the manager passes a bunk ID number, exit out safely
    if not db_ticket:
        raise HTTPException(status_code=404, detail="Target ticket record not found in system architecture.")
    
    # Apply the human text alongside a highly visible compliance marker
    db_ticket.action_taken = f"[MANUAL OVERRIDE BY MANAGER] {payload.manual_action}"
    
    # Commit the transaction to save it persistently inside Supabase cloud
    db.commit()
    db.refresh(db_ticket)
    
    return {
        "status": "Success",
        "message": f"Autonomous action for ticket #{ticket_id} has been permanently overridden.",
        "updated_action": db_ticket.action_taken
    }
