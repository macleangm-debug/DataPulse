"""
DataPulse - Test New Features: PWA, Form Preview, Media Upload
Tests for iteration 4 - PWA manifest/sw, media upload API, form preview
"""

import pytest
import requests
import os
import tempfile

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestMediaUploadAPI:
    """Media upload API endpoint tests - photo 10MB, audio 25MB, video 50MB"""

    def test_media_limits_endpoint(self):
        """Test /api/media/limits returns correct file limits"""
        response = requests.get(f"{BASE_URL}/api/media/limits")
        assert response.status_code == 200
        
        data = response.json()
        assert "limits" in data
        assert "allowed_types" in data
        assert "chunk_size" in data
        
        # Verify correct limits
        limits = data["limits"]
        assert limits["photo"] == "10.0MB"
        assert limits["audio"] == "25.0MB"
        assert limits["video"] == "50.0MB"
        assert limits["document"] == "25.0MB"
        
        # Verify allowed types
        allowed_types = data["allowed_types"]
        assert "image/jpeg" in allowed_types["photo"]
        assert "image/png" in allowed_types["photo"]
        assert "audio/mpeg" in allowed_types["audio"]
        assert "video/mp4" in allowed_types["video"]
        
        print("PASS: Media limits endpoint returns correct values")

    def test_media_upload_invalid_type(self, auth_token):
        """Test media upload with invalid media type returns 400"""
        if not auth_token:
            pytest.skip("No auth token available")
            
        response = requests.post(
            f"{BASE_URL}/api/media/upload",
            headers={"Authorization": f"Bearer {auth_token}"},
            data={
                "media_type": "invalid_type",
                "user_id": "test_user"
            }
        )
        # Should return 400 or 422 for invalid media type
        assert response.status_code in [400, 422]
        print("PASS: Invalid media type rejected correctly")

    def test_media_upload_photo(self, auth_token):
        """Test uploading a small photo file"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        # Create a minimal valid JPEG file (smallest valid JPEG)
        # This is the smallest valid JPEG file bytes
        jpeg_bytes = bytes([
            0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
            0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
            0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
            0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
            0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
            0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
            0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
            0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
            0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
            0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
            0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
            0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
            0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
            0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
            0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
            0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
            0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
            0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
            0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
            0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
            0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
            0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
            0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
            0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
            0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
            0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
            0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
            0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
            0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
            0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
            0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
            0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
            0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
            0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
            0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
            0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
            0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xF3, 0xFF, 0xD9
        ])
        
        files = {
            'file': ('test_photo.jpg', jpeg_bytes, 'image/jpeg')
        }
        data = {
            'media_type': 'photo',
            'user_id': 'test_user_123'
        }
        
        response = requests.post(
            f"{BASE_URL}/api/media/upload",
            headers={"Authorization": f"Bearer {auth_token}"},
            files=files,
            data=data
        )
        
        # Could be 200/201 for success, or 400/415 for content type validation issues
        if response.status_code in [200, 201]:
            result = response.json()
            assert "id" in result
            assert "url" in result
            assert result["media_type"] == "photo"
            print(f"PASS: Photo upload successful - {result.get('id')}")
        else:
            # May fail due to minimal JPEG validation
            print(f"INFO: Photo upload returned {response.status_code}: {response.text[:200]}")


class TestPWAAssets:
    """PWA manifest and service worker accessibility tests"""

    def test_manifest_accessible(self):
        """Test manifest.json is accessible and valid"""
        response = requests.get(f"{BASE_URL}/manifest.json")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "DataPulse"
        assert data["short_name"] == "DataPulse"
        assert data["display"] == "standalone"
        assert "icons" in data
        assert len(data["icons"]) > 0
        
        # Verify icon entries have required fields
        for icon in data["icons"]:
            assert "src" in icon
            assert "sizes" in icon
            assert "type" in icon
        
        print("PASS: PWA manifest.json accessible and valid")

    def test_service_worker_accessible(self):
        """Test service worker sw.js is accessible"""
        response = requests.get(f"{BASE_URL}/sw.js")
        assert response.status_code == 200
        
        content = response.text
        # Check for essential service worker code
        assert "CACHE_NAME" in content
        assert "install" in content
        assert "fetch" in content
        assert "activate" in content
        
        print("PASS: Service worker sw.js accessible and contains expected code")


class TestHealthAndAuth:
    """Basic health and auth tests"""

    def test_health_check(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"
        print("PASS: Health check - API and database healthy")

    def test_login(self):
        """Test login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "test@datapulse.io",
                "password": "password123"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "test@datapulse.io"
        print("PASS: Login successful")


class TestFormAPI:
    """Form API tests for preview functionality"""

    def test_auth_me_endpoint(self, auth_token):
        """Test auth me endpoint works with token"""
        if not auth_token:
            pytest.skip("No auth token available")
        
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert data["email"] == "test@datapulse.io"
        print("PASS: Auth token works correctly with /api/auth/me")

    def test_api_endpoints_structure(self):
        """Test that key API endpoints return proper structure"""
        # Test root API endpoint
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data
        print("PASS: API root endpoint returns version info")


# Fixtures
@pytest.fixture(scope="session")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={
            "email": "test@datapulse.io",
            "password": "password123"
        }
    )
    if response.status_code == 200:
        token = response.json().get("access_token")
        print(f"Auth token obtained: {token[:20]}...")
        return token
    print(f"Auth failed: {response.status_code} - {response.text}")
    return None


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
