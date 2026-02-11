"""
DataPulse AI Services and Real-time Features Tests
Tests for: AI Sentiment, Translation, Quality Check, Predictive Analytics,
Real-time Dashboards, Geofencing, and Blockchain Verification
"""
import pytest
import requests
import os
import uuid
import json
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"

# Test IDs from review_request
ORG_ID = "09872b0e-9cb6-4aac-b46d-54a709c7f4b6"
FORM_ID = "679a763e-f27e-4b79-aa56-8d564e32381c"
GEOFENCE_ID = "2255aa4f-32b1-48a3-bc2f-b79ea076c5fa"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    return response.json().get("access_token")


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get authenticated headers"""
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json"
    }


# ==================== AI Sentiment Analysis Tests ====================

class TestAISentiment:
    """Tests for POST /api/ai/sentiment endpoint"""
    
    def test_sentiment_positive_text(self, auth_headers):
        """Test sentiment analysis with positive text"""
        response = requests.post(
            f"{BASE_URL}/api/ai/sentiment",
            headers=auth_headers,
            json={
                "text": "I absolutely love this product! It's amazing and works perfectly. Best purchase ever!",
                "submission_id": None,
                "field_id": None
            }
        )
        assert response.status_code == 200, f"Sentiment analysis failed: {response.text}"
        
        data = response.json()
        assert "sentiment" in data
        assert data["sentiment"] in ["positive", "negative", "neutral", "mixed"]
        assert "confidence" in data
        assert 0 <= data["confidence"] <= 1
        assert "emotions" in data
        assert "key_phrases" in data
        print(f"Sentiment result: {data['sentiment']} with confidence {data['confidence']}")
    
    def test_sentiment_negative_text(self, auth_headers):
        """Test sentiment analysis with negative text"""
        response = requests.post(
            f"{BASE_URL}/api/ai/sentiment",
            headers=auth_headers,
            json={
                "text": "This is terrible. Very disappointed with the service. Would not recommend.",
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["sentiment"] in ["positive", "negative", "neutral", "mixed"]
        assert "emotions" in data
        print(f"Negative text sentiment: {data['sentiment']}")
    
    def test_sentiment_unauthorized(self):
        """Test sentiment analysis without auth"""
        response = requests.post(
            f"{BASE_URL}/api/ai/sentiment",
            json={"text": "Test text"}
        )
        assert response.status_code in [401, 403], "Should reject unauthorized access"


# ==================== AI Translation Tests ====================

class TestAITranslation:
    """Tests for POST /api/ai/translate endpoint"""
    
    def test_translate_english_to_spanish(self, auth_headers):
        """Test translation from English to Spanish"""
        response = requests.post(
            f"{BASE_URL}/api/ai/translate",
            headers=auth_headers,
            json={
                "text": "Hello, how are you today?",
                "source_language": "en",
                "target_language": "es",
                "preserve_formatting": True
            }
        )
        assert response.status_code == 200, f"Translation failed: {response.text}"
        
        data = response.json()
        assert "original" in data
        assert "translated" in data
        assert data["target_language"] == "es"
        assert data["translated"] != data["original"]
        print(f"Translation: '{data['original']}' -> '{data['translated']}'")
    
    def test_translate_french_to_english(self, auth_headers):
        """Test translation from French to English"""
        response = requests.post(
            f"{BASE_URL}/api/ai/translate",
            headers=auth_headers,
            json={
                "text": "Bonjour, comment allez-vous?",
                "source_language": "fr",
                "target_language": "en"
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "translated" in data
        print(f"French to English: {data['translated']}")
    
    def test_translate_auto_detect(self, auth_headers):
        """Test translation with auto language detection"""
        response = requests.post(
            f"{BASE_URL}/api/ai/translate",
            headers=auth_headers,
            json={
                "text": "Guten Tag, wie geht es Ihnen?",
                "target_language": "en"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "translated" in data
        print(f"Auto-detect translation: {data['translated']}")


class TestAITranslateForm:
    """Tests for POST /api/ai/translate/form endpoint"""
    
    def test_translate_form_labels(self, auth_headers):
        """Test translating all form labels to Spanish"""
        response = requests.post(
            f"{BASE_URL}/api/ai/translate/form",
            headers=auth_headers,
            params={"form_id": FORM_ID, "target_language": "es"}
        )
        # Form may have no labels or may succeed
        assert response.status_code in [200, 404], f"Form translation failed: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            print(f"Form translation result: {data}")
    
    def test_translate_form_not_found(self, auth_headers):
        """Test translating non-existent form"""
        response = requests.post(
            f"{BASE_URL}/api/ai/translate/form",
            headers=auth_headers,
            params={"form_id": "non-existent-form", "target_language": "es"}
        )
        assert response.status_code == 404


# ==================== AI Quality Check Tests ====================

class TestAIQualityCheck:
    """Tests for POST /api/ai/quality/check endpoint"""
    
    def test_quality_check_basic(self, auth_headers):
        """Test AI-powered data quality check"""
        submission_id = f"test-sub-{uuid.uuid4()}"
        response = requests.post(
            f"{BASE_URL}/api/ai/quality/check",
            headers=auth_headers,
            json={
                "submission_id": submission_id,
                "form_id": FORM_ID,
                "data": {
                    "name": "John Doe",
                    "age": 35,
                    "email": "john@example.com",
                    "income": 50000
                },
                "check_types": ["outliers", "duplicates", "inconsistencies"]
            }
        )
        assert response.status_code == 200, f"Quality check failed: {response.text}"
        
        data = response.json()
        assert "submission_id" in data
        assert "quality_score" in data
        assert 0 <= data["quality_score"] <= 100
        assert "issues" in data
        assert "issue_count" in data
        print(f"Quality score: {data['quality_score']}, Issues: {data['issue_count']}")
    
    def test_quality_check_with_anomalies(self, auth_headers):
        """Test quality check with potentially anomalous data"""
        submission_id = f"test-anomaly-{uuid.uuid4()}"
        response = requests.post(
            f"{BASE_URL}/api/ai/quality/check",
            headers=auth_headers,
            json={
                "submission_id": submission_id,
                "form_id": FORM_ID,
                "data": {
                    "age": 999,  # Outlier
                    "income": -5000,  # Negative income
                    "email": "invalid-email"  # Invalid format
                },
                "check_types": ["outliers", "inconsistencies"]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "quality_score" in data
        print(f"Anomalous data quality score: {data['quality_score']}")


# ==================== AI Predictions Tests ====================

class TestAIPredictions:
    """Tests for GET /api/ai/predictions/completion endpoint"""
    
    def test_predict_completion_date(self, auth_headers):
        """Test completion date prediction"""
        response = requests.get(
            f"{BASE_URL}/api/ai/predictions/completion/{FORM_ID}",
            headers=auth_headers,
            params={"target_count": 100}
        )
        assert response.status_code == 200, f"Prediction failed: {response.text}"
        
        data = response.json()
        assert "form_id" in data
        assert data["form_id"] == FORM_ID
        # May have insufficient data
        if "message" in data and "Insufficient" in data["message"]:
            print(f"Insufficient data for prediction: {data}")
        else:
            assert "current_count" in data
            assert "target_count" in data
            print(f"Prediction: current={data.get('current_count')}, days_to_target={data.get('days_to_target')}")


# ==================== Real-time Dashboard Tests ====================

class TestRealtimeDashboards:
    """Tests for /api/realtime/dashboards endpoints"""
    
    created_dashboard_id = None
    
    def test_create_dashboard(self, auth_headers):
        """Test creating a new dashboard"""
        response = requests.post(
            f"{BASE_URL}/api/realtime/dashboards",
            headers=auth_headers,
            params={"org_id": ORG_ID},
            json={
                "name": f"TEST_Dashboard_{uuid.uuid4().hex[:8]}",
                "description": "Test dashboard for AI features testing",
                "widgets": [
                    {
                        "id": "widget-1",
                        "type": "counter",
                        "title": "Total Submissions",
                        "data_source": "submissions",
                        "filters": {"form_id": FORM_ID},
                        "config": {},
                        "position": {"x": 0, "y": 0, "w": 4, "h": 3}
                    },
                    {
                        "id": "widget-2",
                        "type": "line_chart",
                        "title": "Submission Trend",
                        "data_source": "submissions",
                        "filters": {},
                        "config": {},
                        "position": {"x": 4, "y": 0, "w": 8, "h": 3}
                    }
                ],
                "refresh_interval": 30,
                "is_public": False
            }
        )
        assert response.status_code == 200, f"Dashboard creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert "message" in data
        TestRealtimeDashboards.created_dashboard_id = data["id"]
        print(f"Created dashboard: {data['id']}")
    
    def test_list_dashboards(self, auth_headers):
        """Test listing dashboards"""
        response = requests.get(
            f"{BASE_URL}/api/realtime/dashboards",
            headers=auth_headers,
            params={"org_id": ORG_ID}
        )
        assert response.status_code == 200, f"List dashboards failed: {response.text}"
        
        data = response.json()
        assert "dashboards" in data
        assert isinstance(data["dashboards"], list)
        print(f"Found {len(data['dashboards'])} dashboards")
    
    def test_get_dashboard_data(self, auth_headers):
        """Test getting real-time widget data"""
        if not TestRealtimeDashboards.created_dashboard_id:
            pytest.skip("No dashboard created")
        
        response = requests.get(
            f"{BASE_URL}/api/realtime/dashboards/{TestRealtimeDashboards.created_dashboard_id}/data",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Get dashboard data failed: {response.text}"
        
        data = response.json()
        assert "dashboard_id" in data
        assert "data" in data
        assert "timestamp" in data
        print(f"Dashboard data: {json.dumps(data['data'], indent=2)[:500]}")
    
    def test_update_dashboard(self, auth_headers):
        """Test updating a dashboard"""
        if not TestRealtimeDashboards.created_dashboard_id:
            pytest.skip("No dashboard created")
        
        response = requests.put(
            f"{BASE_URL}/api/realtime/dashboards/{TestRealtimeDashboards.created_dashboard_id}",
            headers=auth_headers,
            json={
                "name": "Updated Dashboard Name",
                "description": "Updated description",
                "widgets": [
                    {
                        "id": "widget-1",
                        "type": "counter",
                        "title": "Updated Counter",
                        "data_source": "submissions",
                        "filters": {},
                        "config": {},
                        "position": {"x": 0, "y": 0, "w": 4, "h": 3}
                    }
                ],
                "refresh_interval": 60,
                "is_public": True
            }
        )
        assert response.status_code == 200, f"Update dashboard failed: {response.text}"
    
    def test_delete_dashboard(self, auth_headers):
        """Test deleting a dashboard"""
        if not TestRealtimeDashboards.created_dashboard_id:
            pytest.skip("No dashboard created")
        
        response = requests.delete(
            f"{BASE_URL}/api/realtime/dashboards/{TestRealtimeDashboards.created_dashboard_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Delete dashboard failed: {response.text}"


# ==================== Geofencing Tests ====================

class TestGeofencing:
    """Tests for /api/realtime/geofences endpoints"""
    
    created_geofence_id = None
    
    def test_create_geofence_circle(self, auth_headers):
        """Test creating a circle geofence"""
        response = requests.post(
            f"{BASE_URL}/api/realtime/geofences",
            headers=auth_headers,
            params={"org_id": ORG_ID},
            json={
                "name": f"TEST_Geofence_{uuid.uuid4().hex[:8]}",
                "description": "Test geofence for office area",
                "type": "circle",
                "center": {"lat": -1.2921, "lng": 36.8219},  # Nairobi
                "radius": 5000,  # 5km
                "action": "allow",
                "applies_to": [FORM_ID]
            }
        )
        assert response.status_code == 200, f"Geofence creation failed: {response.text}"
        
        data = response.json()
        assert "id" in data
        TestGeofencing.created_geofence_id = data["id"]
        print(f"Created geofence: {data['id']}")
    
    def test_list_geofences(self, auth_headers):
        """Test listing geofences"""
        response = requests.get(
            f"{BASE_URL}/api/realtime/geofences",
            headers=auth_headers,
            params={"org_id": ORG_ID}
        )
        assert response.status_code == 200, f"List geofences failed: {response.text}"
        
        data = response.json()
        assert "geofences" in data
        assert isinstance(data["geofences"], list)
        print(f"Found {len(data['geofences'])} geofences")
    
    def test_check_geofence_inside(self, auth_headers):
        """Test checking location inside geofence"""
        response = requests.post(
            f"{BASE_URL}/api/realtime/geofences/check",
            headers=auth_headers,
            params={"org_id": ORG_ID},
            json={
                "latitude": -1.2921,  # Same as geofence center
                "longitude": 36.8219,
                "form_id": FORM_ID
            }
        )
        assert response.status_code == 200, f"Geofence check failed: {response.text}"
        
        data = response.json()
        assert "location" in data
        assert "overall_action" in data
        assert "can_submit" in data
        assert data["can_submit"] == True  # Should be inside allow zone
        print(f"Inside geofence check: action={data['overall_action']}, can_submit={data['can_submit']}")
    
    def test_check_geofence_outside(self, auth_headers):
        """Test checking location outside geofence"""
        response = requests.post(
            f"{BASE_URL}/api/realtime/geofences/check",
            headers=auth_headers,
            params={"org_id": ORG_ID},
            json={
                "latitude": 40.7128,  # New York - far outside
                "longitude": -74.0060,
                "form_id": FORM_ID
            }
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "overall_action" in data
        print(f"Outside geofence check: action={data['overall_action']}")
    
    def test_delete_geofence(self, auth_headers):
        """Test deleting a geofence"""
        if not TestGeofencing.created_geofence_id:
            pytest.skip("No geofence created")
        
        response = requests.delete(
            f"{BASE_URL}/api/realtime/geofences/{TestGeofencing.created_geofence_id}",
            headers=auth_headers
        )
        assert response.status_code == 200


# ==================== Blockchain Verification Tests ====================

class TestBlockchainVerification:
    """Tests for /api/realtime/blockchain endpoints"""
    
    test_submission_id = None
    
    def test_create_blockchain_record(self, auth_headers):
        """Test creating blockchain record for a submission"""
        # First, get a submission to work with
        response = requests.get(
            f"{BASE_URL}/api/submissions",
            headers=auth_headers,
            params={"form_id": FORM_ID, "limit": 1}
        )
        
        if response.status_code == 200:
            data = response.json()
            # Handle both list and dict response formats
            if isinstance(data, list) and len(data) > 0:
                TestBlockchainVerification.test_submission_id = data[0]["id"]
            elif isinstance(data, dict):
                submissions = data.get("submissions", [])
                if submissions:
                    TestBlockchainVerification.test_submission_id = submissions[0]["id"]
        
        if not TestBlockchainVerification.test_submission_id:
            pytest.skip("No submissions available for blockchain test")
        
        response = requests.post(
            f"{BASE_URL}/api/realtime/blockchain/record",
            headers=auth_headers,
            params={"submission_id": TestBlockchainVerification.test_submission_id}
        )
        
        assert response.status_code == 200, f"Blockchain record creation failed: {response.text}"
        
        data = response.json()
        assert "record_id" in data
        assert "block_hash" in data
        assert "data_hash" in data
        print(f"Blockchain record: hash={data['block_hash'][:16]}...")
    
    def test_verify_blockchain_record(self, auth_headers):
        """Test verifying blockchain record"""
        if not TestBlockchainVerification.test_submission_id:
            pytest.skip("No submission for verification")
        
        response = requests.get(
            f"{BASE_URL}/api/realtime/blockchain/verify/{TestBlockchainVerification.test_submission_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Blockchain verification failed: {response.text}"
        
        data = response.json()
        assert "submission_id" in data
        assert "verified" in data
        print(f"Blockchain verification: verified={data['verified']}, integrity={data.get('data_integrity')}")
    
    def test_verify_nonexistent_record(self, auth_headers):
        """Test verifying non-existent blockchain record"""
        response = requests.get(
            f"{BASE_URL}/api/realtime/blockchain/verify/non-existent-id",
            headers=auth_headers
        )
        
        # Should return 200 with verified=False or 404
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            data = response.json()
            assert data["verified"] == False


# ==================== Run Tests ====================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
