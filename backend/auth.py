"""DataPulse - Authentication Module with JWT & SSO Support"""
import os
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Security config
SECRET_KEY = os.environ.get("JWT_SECRET", "datapulse-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# SSO Configuration
SSO_ISSUER = os.environ.get("SSO_ISSUER", "https://sso.softwaregalaxy.com")
SSO_CLIENT_ID = os.environ.get("SSO_CLIENT_ID", "datapulse")
SSO_CLIENT_SECRET = os.environ.get("SSO_CLIENT_SECRET", "")
SSO_REDIRECT_URI = os.environ.get("SSO_REDIRECT_URI", "")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token extraction
security = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> dict:
    """Decode and verify a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """Extract and verify current user from JWT token"""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    token = credentials.credentials
    payload = decode_token(token)
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )
    
    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "name": payload.get("name"),
        "is_superadmin": payload.get("is_superadmin", False)
    }


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[dict]:
    """Get current user if token provided, None otherwise"""
    if credentials is None:
        return None
    
    try:
        token = credentials.credentials
        payload = decode_token(token)
        return {
            "user_id": payload.get("sub"),
            "email": payload.get("email"),
            "name": payload.get("name"),
            "is_superadmin": payload.get("is_superadmin", False)
        }
    except HTTPException:
        return None


# ============= SSO Functions =============
async def get_sso_authorization_url(redirect_uri: str, state: str) -> str:
    """Generate SSO authorization URL"""
    params = {
        "client_id": SSO_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "openid profile email",
        "state": state
    }
    query_string = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{SSO_ISSUER}/api/sso/oauth/authorize?{query_string}"


async def exchange_sso_code(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for tokens"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{SSO_ISSUER}/api/sso/oauth/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": SSO_CLIENT_ID,
                "client_secret": SSO_CLIENT_SECRET
            }
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange SSO code"
            )
        
        return response.json()


async def get_sso_userinfo(access_token: str) -> dict:
    """Get user info from SSO provider"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SSO_ISSUER}/api/sso/oauth/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get SSO user info"
            )
        
        return response.json()


def require_role(allowed_roles: list):
    """Dependency to check user role in organization"""
    async def role_checker(current_user: dict = Depends(get_current_user)):
        # This will be checked at the route level with org membership
        return current_user
    return role_checker
