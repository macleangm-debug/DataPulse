"""DataPulse - Authentication Routes"""
from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone
import secrets

from models import User, UserCreate, UserOut, TokenResponse
from auth import (
    get_password_hash, verify_password, create_access_token,
    get_sso_authorization_url, exchange_sso_code, get_sso_userinfo
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class SSOCallbackRequest(BaseModel):
    code: str
    redirect_uri: str


# Temporary state storage for SSO (in production, use Redis)
sso_states = {}


@router.post("/register", response_model=TokenResponse)
async def register(request: Request, data: RegisterRequest):
    """Register a new user with email/password"""
    db = request.app.state.db
    
    # Check if email exists
    existing = await db.users.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user
    user = User(
        email=data.email,
        name=data.name,
        hashed_password=get_password_hash(data.password)
    )
    
    user_dict = user.model_dump()
    user_dict["created_at"] = user_dict["created_at"].isoformat()
    if user_dict.get("last_login"):
        user_dict["last_login"] = user_dict["last_login"].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create token
    token = create_access_token({
        "sub": user.id,
        "email": user.email,
        "name": user.name,
        "is_superadmin": user.is_superadmin
    })
    
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar=user.avatar,
            locale=user.locale,
            is_superadmin=user.is_superadmin
        )
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, data: LoginRequest):
    """Login with email/password"""
    db = request.app.state.db
    
    # Find user
    user_doc = await db.users.find_one({"email": data.email}, {"_id": 0})
    if not user_doc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Verify password
    if not user_doc.get("hashed_password") or not verify_password(data.password, user_doc["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    # Update last login
    await db.users.update_one(
        {"id": user_doc["id"]},
        {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create token
    token = create_access_token({
        "sub": user_doc["id"],
        "email": user_doc["email"],
        "name": user_doc["name"],
        "is_superadmin": user_doc.get("is_superadmin", False)
    })
    
    return TokenResponse(
        access_token=token,
        user=UserOut(
            id=user_doc["id"],
            email=user_doc["email"],
            name=user_doc["name"],
            avatar=user_doc.get("avatar"),
            locale=user_doc.get("locale", "en"),
            is_superadmin=user_doc.get("is_superadmin", False)
        )
    )


@router.get("/sso/url")
async def get_sso_url(redirect_uri: str):
    """Get SSO authorization URL"""
    state = secrets.token_urlsafe(32)
    sso_states[state] = {"redirect_uri": redirect_uri}
    
    auth_url = await get_sso_authorization_url(redirect_uri, state)
    return {"auth_url": auth_url, "state": state}


@router.post("/sso/callback", response_model=TokenResponse)
async def sso_callback(request: Request, data: SSOCallbackRequest):
    """Handle SSO callback and create/login user"""
    db = request.app.state.db
    
    try:
        # Exchange code for tokens
        tokens = await exchange_sso_code(data.code, data.redirect_uri)
        
        # Get user info
        userinfo = await get_sso_userinfo(tokens["access_token"])
        
        email = userinfo.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by SSO"
            )
        
        # Find or create user
        user_doc = await db.users.find_one({"email": email}, {"_id": 0})
        
        if user_doc:
            # Update SSO info
            await db.users.update_one(
                {"id": user_doc["id"]},
                {
                    "$set": {
                        "sso_provider": "software_galaxy",
                        "sso_sub": userinfo.get("sub"),
                        "name": userinfo.get("name", user_doc["name"]),
                        "avatar": userinfo.get("picture", user_doc.get("avatar")),
                        "last_login": datetime.now(timezone.utc).isoformat()
                    }
                }
            )
        else:
            # Create new user
            user = User(
                email=email,
                name=userinfo.get("name", email.split("@")[0]),
                avatar=userinfo.get("picture"),
                sso_provider="software_galaxy",
                sso_sub=userinfo.get("sub"),
                locale=userinfo.get("locale", "en")
            )
            
            user_dict = user.model_dump()
            user_dict["created_at"] = user_dict["created_at"].isoformat()
            if user_dict.get("last_login"):
                user_dict["last_login"] = user_dict["last_login"].isoformat()
            
            await db.users.insert_one(user_dict)
            user_doc = user_dict
        
        # Create token
        token = create_access_token({
            "sub": user_doc["id"],
            "email": user_doc["email"],
            "name": user_doc["name"],
            "is_superadmin": user_doc.get("is_superadmin", False)
        })
        
        return TokenResponse(
            access_token=token,
            user=UserOut(
                id=user_doc["id"],
                email=user_doc["email"],
                name=user_doc["name"],
                avatar=user_doc.get("avatar"),
                locale=user_doc.get("locale", "en"),
                is_superadmin=user_doc.get("is_superadmin", False)
            )
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"SSO authentication failed: {str(e)}"
        )


@router.get("/me", response_model=UserOut)
async def get_current_user_info(request: Request):
    """Get current user info"""
    from auth import get_current_user
    from fastapi import Depends
    
    # Manual token extraction for this endpoint
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = auth_header.split(" ")[1]
    from auth import decode_token
    payload = decode_token(token)
    
    db = request.app.state.db
    user_doc = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
    
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserOut(
        id=user_doc["id"],
        email=user_doc["email"],
        name=user_doc["name"],
        avatar=user_doc.get("avatar"),
        locale=user_doc.get("locale", "en"),
        is_superadmin=user_doc.get("is_superadmin", False)
    )
