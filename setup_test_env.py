"""
Simple user seeding script for DataPulse User Management testing
Creates demo user and organization with proper password
"""

import requests
import sys
from datetime import datetime
import uuid

API_URL = "https://chat-persist-4.preview.emergentagent.com"

def create_test_user():
    """Create a new test user for our tests"""
    test_email = f"testuser_{datetime.now().strftime('%H%M%S')}@datapulse.io"
    test_password = "Test123!"
    
    print(f"Creating test user: {test_email}")
    
    response = requests.post(
        f"{API_URL}/api/auth/register",
        json={
            "email": test_email,
            "password": test_password,
            "name": "Test User"
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ User created successfully")
        return {
            "email": test_email,
            "password": test_password,
            "token": data.get("access_token"),
            "user_id": data.get("user", {}).get("id")
        }
    else:
        print(f"❌ Failed to create user: {response.status_code} - {response.text}")
        return None

def create_test_organization(user_data):
    """Create a test organization"""
    if not user_data:
        return None
        
    headers = {
        "Authorization": f"Bearer {user_data['token']}",
        "Content-Type": "application/json"
    }
    
    org_data = {
        "name": "Test Organization",
        "slug": f"test-org-{datetime.now().strftime('%H%M%S')}",
        "description": "Test organization for User Management testing"
    }
    
    print(f"Creating test organization: {org_data['name']}")
    
    response = requests.post(
        f"{API_URL}/api/organizations",
        headers=headers,
        json=org_data
    )
    
    if response.status_code == 200:
        data = response.json()
        org_id = data.get("organization", {}).get("id")
        print(f"✅ Organization created successfully: {org_id}")
        return org_id
    else:
        print(f"❌ Failed to create organization: {response.status_code} - {response.text}")
        return None

def main():
    """Main function to set up test environment"""
    print("🚀 Setting up test environment for User Management testing")
    print("=" * 60)
    
    # Create test user
    user_data = create_test_user()
    if not user_data:
        print("❌ Cannot proceed without test user")
        sys.exit(1)
    
    # Create test organization  
    org_id = create_test_organization(user_data)
    if not org_id:
        print("❌ Cannot proceed without test organization")
        sys.exit(1)
    
    # Output credentials for testing
    print("\n" + "=" * 60)
    print("✅ TEST ENVIRONMENT READY")
    print("=" * 60)
    print(f"Email: {user_data['email']}")
    print(f"Password: {user_data['password']}")
    print(f"User ID: {user_data['user_id']}")
    print(f"Organization ID: {org_id}")
    print(f"Token: {user_data['token'][:50]}...")
    
    # Save to file for backend test
    with open('/app/test_credentials.txt', 'w') as f:
        f.write(f"EMAIL={user_data['email']}\n")
        f.write(f"PASSWORD={user_data['password']}\n")
        f.write(f"USER_ID={user_data['user_id']}\n")
        f.write(f"ORG_ID={org_id}\n")
        f.write(f"TOKEN={user_data['token']}\n")
    
    print("\n💾 Credentials saved to /app/test_credentials.txt")

if __name__ == "__main__":
    main()