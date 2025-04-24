from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from models import User  # Import the User model

# Load environment variables
load_dotenv()

# Database connection parameters from environment variables
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "Database")
DB_NAME = os.getenv("DB_NAME", "loganalyzer_dev")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5433")
DB_SSL = os.getenv("DB_SSL", "false").lower() == "true"

# Construct Database URL
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Create SQLAlchemy engine and session
engine = create_engine(
    DATABASE_URL,
    connect_args={"sslmode": "require"} if DB_SSL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# JWT Settings
SECRET_KEY = os.environ.get("SECRET_KEY", "your_secret_key_here")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

def get_db():
    """
    Dependency to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """
    Get the current authenticated user from JWT token
    
    In a production environment, this would validate the token and look up 
    the user in the database. For now, it returns a default user.
    
    Args:
        token: JWT token from authorization header
        
    Returns:
        User: A User object representing the authenticated user
    """
    if token:
        try:
            # Attempt to decode the token
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = payload.get("sub")
            if user_id is None:
                # Invalid token contents - return default user
                pass
            else:
                # Here you would normally query the database for user details
                # For now, just create a user with the ID from the token
                return User(
                    id=user_id,
                    username=payload.get("username", "user"),
                    email=payload.get("email", f"{user_id}@example.com"),
                    roles=payload.get("roles", [])
                )
        except JWTError:
            # Invalid token - return default user
            pass
    
    # Default user for development or when no valid token is provided
    return User(
        id="default-user",
        username="default",
        email="default@example.com",
        roles=["admin"]  # Give admin role to the default user
    )

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Create a JWT access token
    
    Args:
        data: Data to encode in the token
        expires_delta: Optional custom expiration time
        
    Returns:
        str: Encoded JWT token
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt

def get_token_data(token: str = Depends(oauth2_scheme)):
    """
    Extract and validate data from a JWT token
    
    Args:
        token: JWT token
        
    Returns:
        dict: Token payload data
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def check_admin_role(current_user: User = Depends(get_current_user)):
    """
    Check if the current user has admin role
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        User: The user if they have admin role
        
    Raises:
        HTTPException: If user doesn't have admin role
    """
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user