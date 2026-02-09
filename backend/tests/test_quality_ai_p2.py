"""
Test Quality AI P2 Features - Speeding Detection, Audio Audit, AI Monitoring
Tests for DataPulse Quality & AI Monitoring Module
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@datapulse.io"
TEST_PASSWORD = "password123"


@pytest.fixture(scope="module")
def session():
    """Shared requests session"""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_data(session):
    """Get authentication token and user info"""
    response = session.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, "Authentication failed"
    data = response.json()
    return {
        "token": data.get("access_token"),
        "user": data.get("user")
    }


@pytest.fixture(scope="module")
def authenticated_session(session, auth_data):
    """Session with auth header"""
    session.headers.update({"Authorization": f"Bearer {auth_data['token']}"})
    return session


@pytest.fixture(scope="module")
def org_id(authenticated_session):
    """Create test organization"""
    test_org = {
        "name": f"TEST_QualityAI_Org_{int(datetime.now().timestamp())}",
        "slug": f"test-quality-ai-{int(datetime.now().timestamp())}"
    }
    response = authenticated_session.post(f"{BASE_URL}/api/organizations", json=test_org)
    if response.status_code in [200, 201]:
        return response.json().get("id")
    pytest.skip("Could not create organization")


# ============ Health Check ============
def test_api_health(session):
    """Test API is healthy"""
    response = session.get(f"{BASE_URL}/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
    print("✓ API health check passed")


# ============ Speeding Detection Tests ============
def test_create_speeding_config(authenticated_session, org_id):
    """Test creating speeding detection configuration"""
    form_id = f"test-form-{int(datetime.now().timestamp())}"
    config_data = {
        "org_id": org_id,
        "form_id": form_id,
        "min_completion_time_seconds": 60,
        "warning_threshold_percent": 50,
        "critical_threshold_percent": 25,
        "auto_flag_critical": True,
        "is_active": True
    }
    
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/speeding/configs",
        json=config_data
    )
    
    assert response.status_code == 200, f"Failed to create speeding config: {response.text}"
    data = response.json()
    assert "config_id" in data
    assert data.get("message") == "Speeding detection configured"
    print(f"✓ Created speeding config: {data.get('config_id')}")


def test_list_speeding_configs(authenticated_session, org_id):
    """Test listing speeding detection configurations"""
    response = authenticated_session.get(
        f"{BASE_URL}/api/quality-ai/speeding/configs/{org_id}"
    )
    
    assert response.status_code == 200, f"Failed to list speeding configs: {response.text}"
    data = response.json()
    assert "configs" in data
    assert isinstance(data["configs"], list)
    print(f"✓ Listed {len(data['configs'])} speeding configs")


# ============ Audio Audit Tests ============
def test_create_audio_audit_config(authenticated_session, org_id):
    """Test creating audio audit configuration"""
    form_id = f"test-form-{int(datetime.now().timestamp())}"
    config_data = {
        "org_id": org_id,
        "form_id": form_id,
        "audio_field_id": "consent_audio",
        "min_duration_seconds": 30,
        "sample_percentage": 10.0,
        "is_active": True
    }
    
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/audio-audit/configs",
        json=config_data
    )
    
    assert response.status_code == 200, f"Failed to create audio audit config: {response.text}"
    data = response.json()
    assert "config_id" in data
    assert data.get("message") == "Audio audit configured"
    print(f"✓ Created audio audit config: {data.get('config_id')}")


def test_list_audio_audit_configs(authenticated_session, org_id):
    """Test listing audio audit configurations"""
    response = authenticated_session.get(
        f"{BASE_URL}/api/quality-ai/audio-audit/configs/{org_id}"
    )
    
    assert response.status_code == 200, f"Failed to list audio audit configs: {response.text}"
    data = response.json()
    assert "configs" in data
    assert isinstance(data["configs"], list)
    print(f"✓ Listed {len(data['configs'])} audio audit configs")


# ============ AI Monitoring Tests ============
def test_create_ai_monitoring_config(authenticated_session, org_id):
    """Test creating AI monitoring configuration with GPT-5.2"""
    config_data = {
        "org_id": org_id,
        "detect_speeding": True,
        "detect_straight_lining": True,
        "detect_response_anomalies": True,
        "detect_gps_anomalies": True,
        "detect_duplicates": True,
        "use_ai_analysis": True,
        "ai_analysis_sample_rate": 5.0,
        "anomaly_score_threshold": 0.7,
        "is_active": True
    }
    
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/ai-monitoring/configs",
        json=config_data
    )
    
    assert response.status_code == 200, f"Failed to create AI monitoring config: {response.text}"
    data = response.json()
    assert "config_id" in data
    assert data.get("message") == "AI monitoring configured"
    print(f"✓ Created AI monitoring config with GPT-5.2: {data.get('config_id')}")


def test_list_ai_monitoring_configs(authenticated_session, org_id):
    """Test listing AI monitoring configurations"""
    response = authenticated_session.get(
        f"{BASE_URL}/api/quality-ai/ai-monitoring/configs/{org_id}"
    )
    
    assert response.status_code == 200, f"Failed to list AI monitoring configs: {response.text}"
    data = response.json()
    assert "configs" in data
    assert isinstance(data["configs"], list)
    print(f"✓ Listed {len(data['configs'])} AI monitoring configs")


# ============ Quality Alerts Tests ============
def test_get_quality_alerts(authenticated_session, org_id):
    """Test getting quality alerts list"""
    response = authenticated_session.get(
        f"{BASE_URL}/api/quality-ai/alerts/{org_id}"
    )
    
    assert response.status_code == 200, f"Failed to get alerts: {response.text}"
    data = response.json()
    assert "alerts" in data
    assert "total" in data
    assert isinstance(data["alerts"], list)
    print(f"✓ Got {len(data['alerts'])} quality alerts (total: {data['total']})")


def test_get_alerts_summary(authenticated_session, org_id):
    """Test getting alerts summary with stats"""
    response = authenticated_session.get(
        f"{BASE_URL}/api/quality-ai/alerts/{org_id}/summary"
    )
    
    assert response.status_code == 200, f"Failed to get alerts summary: {response.text}"
    data = response.json()
    assert "total_open" in data
    assert "total_resolved" in data
    assert "by_type" in data
    assert "by_severity" in data
    print(f"✓ Got alerts summary - Open: {data['total_open']}, Resolved: {data['total_resolved']}")


# ============ Batch Analysis Test ============
def test_run_batch_analysis(authenticated_session, org_id):
    """Test running batch analysis"""
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/batch-analyze/{org_id}",
        json={"hours": 24}
    )
    
    assert response.status_code == 200, f"Failed to start batch analysis: {response.text}"
    data = response.json()
    assert "message" in data
    assert "submission_count" in data
    print(f"✓ Batch analysis started for {data['submission_count']} submissions")


# ============ Edge Cases ============
def test_analyze_nonexistent_submission_speed(authenticated_session):
    """Test analyzing non-existent submission returns 404"""
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/speeding/analyze/nonexistent_submission_12345"
    )
    assert response.status_code == 404
    print("✓ Non-existent submission returns 404 for speeding analysis")


def test_audio_check_nonexistent_submission(authenticated_session):
    """Test audio check on non-existent submission returns 404"""
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/audio-audit/check/nonexistent_submission_12345"
    )
    assert response.status_code == 404
    print("✓ Non-existent submission returns 404 for audio check")


def test_ai_analyze_nonexistent_submission(authenticated_session):
    """Test AI analysis on non-existent submission returns 404"""
    response = authenticated_session.post(
        f"{BASE_URL}/api/quality-ai/ai-monitoring/analyze/nonexistent_submission_12345"
    )
    assert response.status_code == 404
    print("✓ Non-existent submission returns 404 for AI analysis")


def test_resolve_nonexistent_alert(authenticated_session):
    """Test resolving non-existent alert returns 404"""
    response = authenticated_session.put(
        f"{BASE_URL}/api/quality-ai/alerts/nonexistent_alert_12345/resolve",
        json={"resolution": "Test resolution"}
    )
    assert response.status_code == 404
    print("✓ Non-existent alert returns 404 for resolve")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
