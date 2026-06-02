import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from dotenv import load_dotenv

# Ensure environment variables are loaded
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Create the core engine that manages the network sockets
engine = create_engine(DATABASE_URL)

# Create a session factory to spin up quick transactional sessions
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# The base class that our database models will inherit from later
Base = declarative_base()
