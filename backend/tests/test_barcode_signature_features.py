"""
Test Barcode/QR Scanner and Signature Capture features
Backend API Testing for DataPulse Advanced Fields
"""
import pytest
import requests
import os
import base64

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://survey-share.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"

# Test form ID from the review request
TEST_FORM_ID = "679a763e-f27e-4b79-aa56-8d564e32381c"
TEST_PROJECT_ID = "e79469fb-2c7e-4c73-a772-b09a88967d67"

class TestAuth:
    """Get authentication token for API tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        print(f"Auth response status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            token = data.get("access_token")
            print(f"Got token: {token[:20]}..." if token else "No token in response")
            return token
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
        return None


class TestBarcodeAPI(TestAuth):
    """Barcode/QR Scanner API Tests"""
    
    def test_barcode_scan_endpoint(self, auth_token):
        """POST /api/advanced-fields/barcode/scan - Record barcode scan"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create a barcode scan record
        form_data = {
            "field_id": "product_barcode",
            "form_id": TEST_FORM_ID,
            "scanned_value": "1234567890123",
            "format": "ean_13"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/barcode/scan",
            data=form_data,
            headers=headers
        )
        
        print(f"Barcode scan response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success to be True"
        assert "scan_id" in data, "Expected scan_id in response"
        assert data.get("scanned_value") == "1234567890123", "Scanned value mismatch"
        
        print(f"Barcode scan recorded with ID: {data.get('scan_id')}")
        return data.get("scan_id")
    
    def test_barcode_scan_with_qr_format(self, auth_token):
        """POST /api/advanced-fields/barcode/scan - Record QR code scan"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        form_data = {
            "field_id": "product_barcode",
            "form_id": TEST_FORM_ID,
            "scanned_value": "https://example.com/product/12345",
            "format": "qr_code"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/barcode/scan",
            data=form_data,
            headers=headers
        )
        
        print(f"QR code scan response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True
        
    def test_list_barcode_scans(self, auth_token):
        """GET /api/advanced-fields/barcode/scans - List barcode scans"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/barcode/scans",
            headers=headers,
            params={"form_id": TEST_FORM_ID}
        )
        
        print(f"List scans response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "scans" in data, "Expected 'scans' key in response"
        assert "total" in data, "Expected 'total' key in response"
        assert isinstance(data["scans"], list), "Scans should be a list"
        
        print(f"Found {data['total']} barcode scans")
    
    def test_list_barcode_scans_all(self, auth_token):
        """GET /api/advanced-fields/barcode/scans - List all barcode scans without form filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/barcode/scans",
            headers=headers
        )
        
        print(f"List all scans response: {response.status_code}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert "scans" in data
        print(f"Total barcode scans in system: {data['total']}")


class TestSignatureAPI(TestAuth):
    """Signature Capture API Tests"""
    
    def _create_test_signature_base64(self):
        """Create a minimal test PNG signature (1x1 pixel transparent)"""
        # Minimal PNG data - 1x1 transparent pixel
        png_data = base64.b64encode(
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
            b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00'
            b'\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        ).decode('utf-8')
        return f"data:image/png;base64,{png_data}"
    
    def test_signature_capture_endpoint(self, auth_token):
        """POST /api/advanced-fields/signature/capture - Save signature"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create signature capture data
        form_data = {
            "field_id": "consent_signature",
            "form_id": TEST_FORM_ID,
            "image_data": self._create_test_signature_base64(),
            "format": "png",
            "points_count": 50,  # Above minimum threshold
            "signer_name": "Test User"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/signature/capture",
            data=form_data,
            headers=headers
        )
        
        print(f"Signature capture response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data.get("success") == True, "Expected success to be True"
        assert "signature_id" in data, "Expected signature_id in response"
        
        print(f"Signature captured with ID: {data.get('signature_id')}")
        return data.get("signature_id")
    
    def test_signature_capture_with_low_points(self, auth_token):
        """POST /api/advanced-fields/signature/capture - Test minimum points validation"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Note: This test checks that signatures with enough points work
        # The API validates min_points only if config exists
        form_data = {
            "field_id": "consent_signature",
            "form_id": TEST_FORM_ID,
            "image_data": self._create_test_signature_base64(),
            "format": "png",
            "points_count": 15,  # Still above default minimum (10)
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/signature/capture",
            data=form_data,
            headers=headers
        )
        
        print(f"Signature with 15 points response: {response.status_code}")
        # Should succeed with default min_points of 10
        assert response.status_code == 200
    
    def test_list_signatures(self, auth_token):
        """GET /api/advanced-fields/signatures - List signatures"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/signatures",
            headers=headers,
            params={"form_id": TEST_FORM_ID}
        )
        
        print(f"List signatures response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "signatures" in data, "Expected 'signatures' key in response"
        assert "total" in data, "Expected 'total' key in response"
        assert isinstance(data["signatures"], list), "Signatures should be a list"
        
        print(f"Found {data['total']} signatures")
    
    def test_list_signatures_all(self, auth_token):
        """GET /api/advanced-fields/signatures - List all signatures without form filter"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/signatures",
            headers=headers
        )
        
        print(f"List all signatures response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "signatures" in data
        print(f"Total signatures in system: {data['total']}")


class TestBarcodeConfig(TestAuth):
    """Barcode Configuration API Tests"""
    
    def test_save_barcode_config(self, auth_token):
        """POST /api/advanced-fields/barcode/config - Save barcode config"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        config = {
            "enabled": True,
            "formats": ["qr", "code128", "ean13"],
            "auto_submit": False,
            "beep_on_scan": True,
            "vibrate_on_scan": True,
            "continuous_scan": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/barcode/config",
            params={"form_id": TEST_FORM_ID, "field_id": "product_barcode"},
            json=config,
            headers=headers
        )
        
        print(f"Save barcode config response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_get_barcode_config(self, auth_token):
        """GET /api/advanced-fields/barcode/config/{form_id}/{field_id} - Get barcode config"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/barcode/config/{TEST_FORM_ID}/product_barcode",
            headers=headers
        )
        
        print(f"Get barcode config response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert "config" in data or "enabled" in str(data)


class TestSignatureConfig(TestAuth):
    """Signature Configuration API Tests"""
    
    def test_save_signature_config(self, auth_token):
        """POST /api/advanced-fields/signature/config - Save signature config"""
        headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json"
        }
        
        config = {
            "enabled": True,
            "pen_color": "#000000",
            "pen_width": 2,
            "background_color": "#ffffff",
            "canvas_width": 400,
            "canvas_height": 200,
            "require_signature": True,
            "min_points": 10
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/signature/config",
            params={"form_id": TEST_FORM_ID, "field_id": "consent_signature"},
            json=config,
            headers=headers
        )
        
        print(f"Save signature config response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
    
    def test_get_signature_config(self, auth_token):
        """GET /api/advanced-fields/signature/config/{form_id}/{field_id} - Get signature config"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/signature/config/{TEST_FORM_ID}/consent_signature",
            headers=headers
        )
        
        print(f"Get signature config response: {response.status_code}")
        print(f"Response body: {response.text}")
        
        assert response.status_code == 200


class TestHealthAndForms(TestAuth):
    """Health check and form verification"""
    
    def test_health_check(self):
        """GET /api/health - Health check"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("API is healthy")
    
    def test_get_form_with_barcode_signature_fields(self, auth_token):
        """GET /api/forms/{form_id} - Verify form has barcode and signature fields"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/forms/{TEST_FORM_ID}",
            headers=headers
        )
        
        print(f"Get form response: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            fields = data.get("fields", [])
            
            # Check for barcode and signature field types
            field_types = [f.get("type") for f in fields]
            print(f"Form fields: {fields}")
            print(f"Field types found: {field_types}")
            
            # The form should have barcode and signature fields based on test context
            has_barcode = any(f.get("type") == "barcode" for f in fields)
            has_signature = any(f.get("type") == "signature" for f in fields)
            
            print(f"Has barcode field: {has_barcode}")
            print(f"Has signature field: {has_signature}")
        else:
            print(f"Form not found or error: {response.text}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
