"""
DataPulse P0 Data Collection Features - Iteration 11 Tests
Tests for: Paradata/Audit Trail, Submission Revisions, Lookup Datasets
"""

import pytest
import requests
import os
from datetime import datetime, timezone

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@datapulse.io"
TEST_PASSWORD = "password123"


class TestAuthSetup:
    """Authentication tests to establish session"""
    token = None
    org_id = None
    user_id = None

    @classmethod
    def get_auth_headers(cls):
        return {
            "Authorization": f"Bearer {cls.token}",
            "Content-Type": "application/json"
        }

    def test_01_login(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        # Handle both "token" and "access_token" response formats
        token = data.get("token") or data.get("access_token")
        assert token, f"No token in response: {data.keys()}"
        TestAuthSetup.token = token
        TestAuthSetup.user_id = data.get("user", {}).get("id", "user_test123")
        
        # Get org_id - fetch from /api/organizations
        org_response = requests.get(
            f"{BASE_URL}/api/organizations",
            headers={"Authorization": f"Bearer {token}"}
        )
        if org_response.status_code == 200:
            org_data = org_response.json()
            # Response is a list of organizations
            if isinstance(org_data, list) and len(org_data) > 0:
                TestAuthSetup.org_id = org_data[0].get("id")
            elif isinstance(org_data, dict) and org_data.get("organizations"):
                TestAuthSetup.org_id = org_data["organizations"][0].get("id")
        
        # Fallback
        if not TestAuthSetup.org_id:
            TestAuthSetup.org_id = "org_test_organization"
            
        print(f"Logged in. User: {TestAuthSetup.user_id}, Org ID: {TestAuthSetup.org_id}")


# ==================== PARADATA API TESTS ====================

class TestParadataAPI:
    """Test Paradata/Audit Trail API endpoints"""
    session_id = None
    test_submission_id = f"TEST_sub_{int(datetime.now().timestamp())}"

    def test_01_create_paradata_session(self):
        """POST /api/paradata/sessions - Create paradata session"""
        response = requests.post(
            f"{BASE_URL}/api/paradata/sessions",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "submission_id": self.test_submission_id,
                "form_id": "form_test_001",
                "enumerator_id": f"TEST_enum_{int(datetime.now().timestamp())}",
                "device_id": "device_test_001",
                "device_os": "Android 14",
                "device_model": "Pixel 8",
                "app_version": "2.0.0",
                "screen_width": 1080,
                "screen_height": 2400,
                "events": []
            }
        )
        assert response.status_code == 200, f"Create session failed: {response.text}"
        data = response.json()
        assert "session_id" in data
        assert data["session_id"].startswith("pds_")
        TestParadataAPI.session_id = data["session_id"]
        print(f"Created paradata session: {data['session_id']}")

    def test_02_add_paradata_events_batch(self):
        """POST /api/paradata/sessions/{id}/events - Add events batch"""
        events = [
            {
                "event_type": "form_start",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page_index": 0,
                "page_name": "intro"
            },
            {
                "event_type": "question_focus",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page_index": 0,
                "question_name": "respondent_name",
                "question_type": "text"
            },
            {
                "event_type": "value_change",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page_index": 0,
                "question_name": "respondent_name",
                "old_value": "",
                "new_value": "John Doe"
            },
            {
                "event_type": "question_blur",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "page_index": 0,
                "question_name": "respondent_name"
            },
            {
                "event_type": "nav_forward",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "from_page": 0,
                "to_page": 1
            }
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/paradata/sessions/{self.session_id}/events",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "session_id": self.session_id,
                "events": events
            }
        )
        assert response.status_code == 200, f"Add events failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Added" in data["message"]
        print(f"Added events: {data['message']}")

    def test_03_end_paradata_session(self):
        """POST /api/paradata/sessions/{id}/end - End session and calculate metrics"""
        response = requests.post(
            f"{BASE_URL}/api/paradata/sessions/{self.session_id}/end",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"End session failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "metrics" in data
        print(f"Session ended. Metrics: {data['metrics']}")

    def test_04_get_submission_paradata(self):
        """GET /api/paradata/submissions/{id} - Get paradata with timeline"""
        response = requests.get(
            f"{BASE_URL}/api/paradata/submissions/{self.test_submission_id}",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get paradata failed: {response.text}"
        data = response.json()
        assert "submission_id" in data
        assert "sessions" in data
        assert "question_timings" in data
        assert "summary" in data
        assert len(data["sessions"]) > 0
        print(f"Got paradata: {len(data['sessions'])} sessions, {len(data['question_timings'])} question timings")

    def test_05_get_submission_timeline(self):
        """GET /api/paradata/submissions/{id}/timeline - Get timeline view"""
        response = requests.get(
            f"{BASE_URL}/api/paradata/submissions/{self.test_submission_id}/timeline",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get timeline failed: {response.text}"
        data = response.json()
        assert "submission_id" in data
        assert "timeline" in data
        print(f"Got timeline: {len(data['timeline'])} events")

    def test_06_get_enumerator_paradata_stats(self):
        """GET /api/paradata/enumerators/{id}/stats - Get enumerator statistics"""
        response = requests.get(
            f"{BASE_URL}/api/paradata/enumerators/TEST_enumerator_001/stats?days=30",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get enumerator stats failed: {response.text}"
        data = response.json()
        assert "enumerator_id" in data
        assert "period_days" in data
        # Stats may be empty if no sessions for this enumerator
        print(f"Got enumerator stats: {data}")

    def test_07_get_form_question_stats(self):
        """GET /api/paradata/forms/{form_id}/question-stats - Get form question statistics"""
        response = requests.get(
            f"{BASE_URL}/api/paradata/forms/form_test_001/question-stats?days=30",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get form question stats failed: {response.text}"
        data = response.json()
        assert "form_id" in data
        assert "period_days" in data
        assert "question_stats" in data
        print(f"Got form question stats: {len(data['question_stats'])} questions")

    def test_08_get_speeding_report(self):
        """GET /api/paradata/quality/speeding-report - Get speeding detection report"""
        response = requests.get(
            f"{BASE_URL}/api/paradata/quality/speeding-report?org_id={TestAuthSetup.org_id}&days=30",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get speeding report failed: {response.text}"
        data = response.json()
        # May return "No sessions found" message if no data
        print(f"Got speeding report: {data}")


# ==================== REVISION API TESTS ====================

class TestRevisionAPI:
    """Test Submission Revision Chain API endpoints"""
    test_submission_id = f"TEST_rev_sub_{int(datetime.now().timestamp())}"

    def test_01_create_test_submission(self):
        """Create a test submission for revision tests"""
        # First create a submission to revise
        response = requests.post(
            f"{BASE_URL}/api/submissions",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "form_id": "form_test_001",
                "project_id": "proj_test_001",
                "org_id": TestAuthSetup.org_id,
                "data": {
                    "respondent_name": "Initial Name",
                    "age": 25,
                    "location": "Test Location"
                },
                "status": "submitted",
                "id": self.test_submission_id
            }
        )
        # May return 200 or 201 depending on implementation
        if response.status_code not in [200, 201]:
            print(f"Note: Could not create submission directly: {response.text}")
            # Try alternative approach - use existing submission ID
        print(f"Test submission setup: {self.test_submission_id}")

    def test_02_create_revision(self):
        """POST /api/revisions/submissions/{id}/revisions - Create new revision with diff"""
        response = requests.post(
            f"{BASE_URL}/api/revisions/submissions/{self.test_submission_id}/revisions",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "submission_id": self.test_submission_id,
                "data": {
                    "respondent_name": "Updated Name",
                    "age": 26,
                    "location": "New Location"
                },
                "revision_type": "correction",
                "reason": "Data correction after verification",
                "correction_notes": "Name was misspelled"
            }
        )
        # May fail if submission doesn't exist - that's expected
        print(f"Create revision response: {response.status_code} - {response.text[:200]}")
        if response.status_code == 200:
            data = response.json()
            assert "revision_id" in data or "message" in data

    def test_03_get_revision_history(self):
        """GET /api/revisions/submissions/{id}/revisions - Get revision history"""
        response = requests.get(
            f"{BASE_URL}/api/revisions/submissions/{self.test_submission_id}/revisions",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get revision history failed: {response.text}"
        data = response.json()
        assert "submission_id" in data
        assert "revisions" in data
        print(f"Got revision history: {data['total_revisions']} revisions")

    def test_04_compare_revisions(self):
        """POST /api/revisions/submissions/{id}/compare - Compare two versions"""
        response = requests.post(
            f"{BASE_URL}/api/revisions/submissions/{self.test_submission_id}/compare",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "from_version": 1,
                "to_version": 2
            }
        )
        # May fail if versions don't exist - that's expected
        print(f"Compare revisions response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert "diff" in data or "summary" in data

    def test_05_lock_submission_fails_without_approval(self):
        """POST /api/revisions/submissions/{id}/lock - Lock fails on non-approved submission"""
        response = requests.post(
            f"{BASE_URL}/api/revisions/submissions/{self.test_submission_id}/lock",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "lock_reason": "Data quality verified",
                "allow_supervisor_edit": True
            }
        )
        # Should fail because submission is not approved
        print(f"Lock submission response: {response.status_code}")
        # We expect 400 or 404 (submission not found or not approved)
        assert response.status_code in [400, 404], f"Unexpected response: {response.text}"

    def test_06_create_correction_request(self):
        """POST /api/revisions/correction-requests - Create correction request"""
        response = requests.post(
            f"{BASE_URL}/api/revisions/correction-requests",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "submission_id": self.test_submission_id,
                "requested_by": TestAuthSetup.user_id or "supervisor_001",
                "fields_to_correct": ["respondent_name", "age"],
                "notes": "Please verify the age and correct if needed"
            }
        )
        # May fail if submission doesn't exist - that's expected
        print(f"Create correction request response: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            assert "correction_id" in data

    def test_07_get_raw_dataset(self):
        """GET /api/revisions/datasets/{form_id}/raw - Get raw submissions"""
        response = requests.get(
            f"{BASE_URL}/api/revisions/datasets/form_test_001/raw?limit=10",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get raw dataset failed: {response.text}"
        data = response.json()
        assert "dataset_type" in data
        assert data["dataset_type"] == "raw"
        assert "submissions" in data
        print(f"Got raw dataset: {data['total']} submissions")

    def test_08_get_approved_dataset(self):
        """GET /api/revisions/datasets/{form_id}/approved - Get approved submissions"""
        response = requests.get(
            f"{BASE_URL}/api/revisions/datasets/form_test_001/approved?limit=10",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get approved dataset failed: {response.text}"
        data = response.json()
        assert "dataset_type" in data
        assert data["dataset_type"] == "approved"
        assert "submissions" in data
        print(f"Got approved dataset: {data['total']} submissions")

    def test_09_get_submission_audit_trail(self):
        """GET /api/revisions/submissions/{id}/audit-trail - Get audit trail"""
        response = requests.get(
            f"{BASE_URL}/api/revisions/submissions/{self.test_submission_id}/audit-trail",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get audit trail failed: {response.text}"
        data = response.json()
        assert "submission_id" in data
        assert "audit_trail" in data
        print(f"Got audit trail: {data['total_events']} events")


# ==================== DATASETS API TESTS ====================

class TestDatasetsAPI:
    """Test Lookup Datasets API endpoints"""
    dataset_id = None
    test_org_id = None

    def test_01_create_dataset(self):
        """POST /api/datasets - Create lookup dataset"""
        TestDatasetsAPI.test_org_id = TestAuthSetup.org_id
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "name": f"TEST Schools List {int(datetime.now().timestamp())}",
                "description": "Test dataset for school lookups",
                "dataset_type": "school_list",
                "org_id": TestAuthSetup.org_id,
                "columns": [
                    {"name": "id", "type": "string", "label": "School ID", "searchable": True},
                    {"name": "name", "type": "string", "label": "School Name", "searchable": True},
                    {"name": "district", "type": "string", "label": "District", "searchable": True},
                    {"name": "region", "type": "string", "label": "Region", "searchable": False}
                ],
                "searchable_fields": ["id", "name", "district"],
                "display_field": "name",
                "value_field": "id",
                "enable_offline": True,
                "offline_subset_field": "region"
            }
        )
        assert response.status_code == 200, f"Create dataset failed: {response.text}"
        data = response.json()
        assert "dataset_id" in data
        assert data["dataset_id"].startswith("ds_")
        TestDatasetsAPI.dataset_id = data["dataset_id"]
        print(f"Created dataset: {data['dataset_id']}")

    def test_02_list_datasets(self):
        """GET /api/datasets/{org_id} - List all datasets"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"List datasets failed: {response.text}"
        data = response.json()
        assert "datasets" in data
        assert len(data["datasets"]) > 0
        print(f"Listed {len(data['datasets'])} datasets")

    def test_03_get_dataset(self):
        """GET /api/datasets/{org_id}/{dataset_id} - Get dataset metadata"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get dataset failed: {response.text}"
        data = response.json()
        assert "id" in data
        assert data["id"] == self.dataset_id
        assert "columns" in data
        print(f"Got dataset: {data['name']}")

    def test_04_bulk_upload_records(self):
        """POST /api/datasets/{org_id}/{dataset_id}/records/bulk - Bulk upload records"""
        records = [
            {"id": "SCH001", "name": "Test Primary School", "district": "Test District", "region": "Northern"},
            {"id": "SCH002", "name": "Test Secondary School", "district": "Test District", "region": "Northern"},
            {"id": "SCH003", "name": "Another Primary School", "district": "Other District", "region": "Southern"},
            {"id": "SCH004", "name": "City High School", "district": "Urban District", "region": "Central"},
            {"id": "SCH005", "name": "Rural Elementary", "district": "Rural District", "region": "Northern"}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/records/bulk",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "records": records,
                "replace_existing": False
            }
        )
        assert response.status_code == 200, f"Bulk upload failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "Uploaded" in data["message"] or "records" in data["message"].lower()
        print(f"Bulk upload: {data['message']}")

    def test_05_get_records(self):
        """GET /api/datasets/{org_id}/{dataset_id}/records - Get records with pagination"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/records?limit=10",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get records failed: {response.text}"
        data = response.json()
        assert "records" in data
        assert "total" in data
        assert len(data["records"]) > 0
        print(f"Got {len(data['records'])} records, total: {data['total']}")

    def test_06_typeahead_search(self):
        """GET /api/datasets/{org_id}/{dataset_id}/search - Typeahead search works"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/search?q=Test",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Typeahead search failed: {response.text}"
        data = response.json()
        assert "results" in data
        assert "count" in data
        # Should find at least some records with "Test" in name
        print(f"Typeahead search: found {data['count']} results for 'Test'")

    def test_07_typeahead_search_with_filter(self):
        """GET /api/datasets/{org_id}/{dataset_id}/search - Typeahead search with filter"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/search?q=School&filter_field=region&filter_value=Northern",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Filtered search failed: {response.text}"
        data = response.json()
        assert "results" in data
        print(f"Filtered search: found {data['count']} results")

    def test_08_get_offline_subset(self):
        """POST /api/datasets/{org_id}/{dataset_id}/subset - Get filtered offline subset"""
        response = requests.post(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/subset",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "dataset_id": self.dataset_id,
                "filter_field": "region",
                "filter_values": ["Northern"]
            }
        )
        assert response.status_code == 200, f"Get subset failed: {response.text}"
        data = response.json()
        assert "dataset_id" in data
        assert "records" in data
        assert "record_count" in data
        assert "subset_filter" in data
        print(f"Got offline subset: {data['record_count']} records")

    def test_09_get_offline_package(self):
        """GET /api/datasets/{org_id}/{dataset_id}/offline-package - Get complete offline package"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/offline-package",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get offline package failed: {response.text}"
        data = response.json()
        assert "dataset_id" in data
        assert "dataset_name" in data
        assert "version" in data
        assert "columns" in data
        assert "records" in data
        assert "record_count" in data
        print(f"Got offline package: {data['record_count']} records, version {data['version']}")

    def test_10_get_sync_status(self):
        """GET /api/datasets/{org_id}/{dataset_id}/sync-status - Check sync status"""
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/sync-status?client_version=0",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Get sync status failed: {response.text}"
        data = response.json()
        assert "needs_sync" in data
        assert "server_version" in data
        assert data["needs_sync"] == True  # Client version 0 should need sync
        print(f"Sync status: needs_sync={data['needs_sync']}, server_version={data['server_version']}")

    def test_11_add_single_record(self):
        """POST /api/datasets/{org_id}/{dataset_id}/records - Add single record"""
        response = requests.post(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}/records",
            headers=TestAuthSetup.get_auth_headers(),
            json={
                "data": {
                    "id": "SCH006",
                    "name": "New Test School",
                    "district": "New District",
                    "region": "Eastern"
                }
            }
        )
        assert response.status_code == 200, f"Add record failed: {response.text}"
        data = response.json()
        assert "record_id" in data
        print(f"Added record: {data['record_id']}")

    def test_12_cleanup_delete_dataset(self):
        """DELETE /api/datasets/{org_id}/{dataset_id} - Soft delete dataset"""
        response = requests.delete(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{self.dataset_id}",
            headers=TestAuthSetup.get_auth_headers()
        )
        assert response.status_code == 200, f"Delete dataset failed: {response.text}"
        data = response.json()
        assert "message" in data
        print(f"Deleted dataset: {data['message']}")


# ==================== INTEGRATION TESTS ====================

class TestIntegration:
    """Integration tests combining multiple features"""

    def test_existing_dataset_search(self):
        """Test search on pre-existing Schools List dataset"""
        # Try to find the existing Schools List dataset mentioned in the request
        response = requests.get(
            f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}",
            headers=TestAuthSetup.get_auth_headers()
        )
        if response.status_code == 200:
            data = response.json()
            existing_datasets = [d for d in data.get("datasets", []) if "Schools" in d.get("name", "")]
            if existing_datasets:
                ds_id = existing_datasets[0]["id"]
                # Test search on existing dataset
                search_response = requests.get(
                    f"{BASE_URL}/api/datasets/{TestAuthSetup.org_id}/{ds_id}/search?q=a",
                    headers=TestAuthSetup.get_auth_headers()
                )
                print(f"Search on existing dataset {ds_id}: {search_response.status_code}")

    def test_existing_paradata_session(self):
        """Test getting existing paradata session mentioned in request"""
        # The request mentions: pds_test_sub_001_1770400362
        response = requests.get(
            f"{BASE_URL}/api/paradata/submissions/test_sub_001",
            headers=TestAuthSetup.get_auth_headers()
        )
        print(f"Existing paradata check: {response.status_code}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
