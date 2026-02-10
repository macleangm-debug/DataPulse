"""
DataPulse Review Workflow API Tests
Tests for: Queue, Stats, Claim, Release, Decide, Corrections endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"


class TestReviewWorkflowAPIs:
    """Review Workflow API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup auth token for all tests"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Get auth token
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("access_token")
        self.user_id = data.get("user", {}).get("id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
    # ============= Stats Endpoint Tests =============
    
    def test_get_queue_stats_success(self):
        """Test GET /api/review/queue/stats returns proper stats"""
        response = self.session.get(f"{BASE_URL}/api/review/queue/stats")
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "pending" in data
        assert "in_review" in data
        assert "approved" in data
        assert "rejected" in data
        assert "correction_requested" in data
        assert "total" in data
        
        # Validate data types
        assert isinstance(data["pending"], int)
        assert isinstance(data["in_review"], int)
        assert isinstance(data["approved"], int)
        assert isinstance(data["total"], int)
        
        # Verify expected counts based on test setup
        assert data["total"] >= 3, "Should have at least 3 test submissions"
        print(f"Stats: pending={data['pending']}, in_review={data['in_review']}, total={data['total']}")

    def test_get_queue_stats_requires_auth(self):
        """Test stats endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/review/queue/stats")
        assert response.status_code == 401

    # ============= Queue Endpoint Tests =============
    
    def test_get_queue_success(self):
        """Test GET /api/review/queue returns submissions list"""
        response = self.session.get(f"{BASE_URL}/api/review/queue?limit=100")
        
        assert response.status_code == 200
        data = response.json()
        
        # Validate response structure
        assert "submissions" in data
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        
        # Validate submissions array
        assert isinstance(data["submissions"], list)
        assert data["total"] >= 0
        
        # If we have submissions, validate structure
        if len(data["submissions"]) > 0:
            sub = data["submissions"][0]
            assert "id" in sub
            assert "form_id" in sub
            assert "status" in sub
            assert "submitted_at" in sub
            assert "pending_corrections" in sub
            print(f"Queue has {len(data['submissions'])} submissions")
    
    def test_get_queue_with_status_filter(self):
        """Test queue filtering by status"""
        # Filter by pending status
        response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
        assert response.status_code == 200
        data = response.json()
        
        # All returned submissions should be pending
        for sub in data["submissions"]:
            assert sub["status"] == "pending", f"Expected pending, got {sub['status']}"
    
    def test_get_queue_requires_auth(self):
        """Test queue endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/review/queue")
        assert response.status_code == 401

    # ============= Claim Endpoint Tests =============
    
    def test_claim_pending_submission(self):
        """Test claiming a pending submission"""
        # Get a pending submission
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
        assert queue_response.status_code == 200
        pending_submissions = queue_response.json()["submissions"]
        
        if len(pending_submissions) == 0:
            pytest.skip("No pending submissions available to claim")
        
        submission_id = pending_submissions[0]["id"]
        
        # Claim the submission
        response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/claim")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "claimed" in data["message"].lower() or "review" in data["message"].lower()
        
        # Verify submission is now in_review
        verify_response = self.session.get(f"{BASE_URL}/api/review/queue?status=in_review")
        in_review = verify_response.json()["submissions"]
        claimed_ids = [s["id"] for s in in_review]
        assert submission_id in claimed_ids, "Claimed submission should be in_review"
        print(f"Successfully claimed submission {submission_id}")
    
    def test_claim_already_claimed_submission(self):
        """Test claiming an already claimed submission fails"""
        # Get an in_review submission
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?status=in_review")
        in_review_submissions = queue_response.json()["submissions"]
        
        if len(in_review_submissions) == 0:
            pytest.skip("No in_review submissions to test")
        
        submission_id = in_review_submissions[0]["id"]
        
        # Try to claim again
        response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/claim")
        
        # Should fail since it's already claimed
        assert response.status_code == 400

    # ============= Release Endpoint Tests =============
    
    def test_release_claimed_submission(self):
        """Test releasing a claimed submission back to pending"""
        # First ensure we have a claimed submission
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?status=in_review")
        in_review = queue_response.json()["submissions"]
        
        # Find one claimed by current user or claim one
        my_claimed = [s for s in in_review if s.get("reviewer_id") == self.user_id]
        
        if len(my_claimed) == 0:
            # Try to claim one first
            pending_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
            pending = pending_response.json()["submissions"]
            if len(pending) == 0:
                pytest.skip("No submissions available to test release")
            
            claim_response = self.session.post(f"{BASE_URL}/api/review/submissions/{pending[0]['id']}/claim")
            if claim_response.status_code != 200:
                pytest.skip("Could not claim a submission to test release")
            submission_id = pending[0]["id"]
        else:
            submission_id = my_claimed[0]["id"]
        
        # Release the submission
        response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/release")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        print(f"Released submission {submission_id}")

    # ============= Decide Endpoint Tests =============
    
    def test_decide_approve_submission(self):
        """Test approving a submission"""
        # Need to claim a submission first
        pending_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
        pending = pending_response.json()["submissions"]
        
        if len(pending) == 0:
            pytest.skip("No pending submissions to test approve")
        
        submission_id = pending[0]["id"]
        
        # Claim it
        claim_response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/claim")
        if claim_response.status_code != 200:
            pytest.skip("Could not claim submission for approve test")
        
        # Approve it
        response = self.session.post(
            f"{BASE_URL}/api/review/submissions/{submission_id}/decide",
            json={
                "decision": "approve",
                "notes": "Test approval - all data verified",
                "quality_flags": []
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_status"] == "approved"
        print(f"Approved submission {submission_id}")

    def test_decide_reject_submission(self):
        """Test rejecting a submission"""
        # Create a new submission for this test to avoid conflicts
        pending_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
        pending = pending_response.json()["submissions"]
        
        if len(pending) == 0:
            pytest.skip("No pending submissions to test reject")
        
        submission_id = pending[0]["id"]
        
        # Claim it
        claim_response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/claim")
        if claim_response.status_code != 200:
            pytest.skip("Could not claim submission for reject test")
        
        # Reject it
        response = self.session.post(
            f"{BASE_URL}/api/review/submissions/{submission_id}/decide",
            json={
                "decision": "reject",
                "notes": "Test rejection - invalid data",
                "quality_flags": ["speeding", "straightlining"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_status"] == "rejected"
        print(f"Rejected submission {submission_id}")

    def test_decide_request_correction(self):
        """Test requesting correction on a submission"""
        pending_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
        pending = pending_response.json()["submissions"]
        
        if len(pending) == 0:
            pytest.skip("No pending submissions to test correction request")
        
        submission_id = pending[0]["id"]
        
        # Claim it
        claim_response = self.session.post(f"{BASE_URL}/api/review/submissions/{submission_id}/claim")
        if claim_response.status_code != 200:
            pytest.skip("Could not claim submission for correction test")
        
        # Request correction
        response = self.session.post(
            f"{BASE_URL}/api/review/submissions/{submission_id}/decide",
            json={
                "decision": "request_correction",
                "notes": "Please re-verify the barcode",
                "quality_flags": ["gps_anomaly"]
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["new_status"] == "correction_requested"
        print(f"Requested correction for submission {submission_id}")

    def test_decide_invalid_decision(self):
        """Test invalid decision returns error"""
        # Get any submission that can be decided (in_review)
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?status=in_review")
        in_review = queue_response.json()["submissions"]
        
        if len(in_review) == 0:
            # Try to claim one
            pending_response = self.session.get(f"{BASE_URL}/api/review/queue?status=pending")
            pending = pending_response.json()["submissions"]
            if len(pending) == 0:
                pytest.skip("No submissions available")
            
            claim_response = self.session.post(f"{BASE_URL}/api/review/submissions/{pending[0]['id']}/claim")
            if claim_response.status_code != 200:
                pytest.skip("Could not claim submission")
            submission_id = pending[0]["id"]
        else:
            submission_id = in_review[0]["id"]
        
        # Try invalid decision
        response = self.session.post(
            f"{BASE_URL}/api/review/submissions/{submission_id}/decide",
            json={
                "decision": "invalid_decision",
                "notes": "Test"
            }
        )
        
        assert response.status_code == 400

    # ============= Corrections Endpoint Tests =============
    
    def test_list_corrections(self):
        """Test listing correction requests"""
        response = self.session.get(f"{BASE_URL}/api/review/corrections?limit=50")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "corrections" in data
        assert "total" in data
        assert isinstance(data["corrections"], list)
        print(f"Found {len(data['corrections'])} corrections")
    
    def test_create_correction_request(self):
        """Test creating a correction request"""
        # Get any submission
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?limit=100")
        submissions = queue_response.json()["submissions"]
        
        if len(submissions) == 0:
            pytest.skip("No submissions available")
        
        submission_id = submissions[0]["id"]
        
        # Create correction request
        response = self.session.post(
            f"{BASE_URL}/api/review/corrections",
            json={
                "submission_id": submission_id,
                "priority": "medium",
                "field_corrections": [
                    {
                        "field_id": "test_field",
                        "field_name": "Test Field",
                        "current_value": "test",
                        "issue_description": "Please verify this value",
                        "is_required": True
                    }
                ],
                "general_notes": "Test correction request"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "correction_id" in data
        print(f"Created correction request {data['correction_id']}")
        
        # Verify correction was created
        verify_response = self.session.get(f"{BASE_URL}/api/review/corrections")
        corrections = verify_response.json()["corrections"]
        correction_ids = [c["id"] for c in corrections]
        assert data["correction_id"] in correction_ids

    def test_corrections_requires_auth(self):
        """Test corrections endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/review/corrections")
        assert response.status_code == 401

    # ============= Config Endpoint Tests =============
    
    def test_get_workflow_config(self):
        """Test getting workflow config"""
        # Get a form_id from submissions
        queue_response = self.session.get(f"{BASE_URL}/api/review/queue?limit=1")
        submissions = queue_response.json()["submissions"]
        
        if len(submissions) == 0:
            pytest.skip("No submissions to get form_id")
        
        form_id = submissions[0]["form_id"]
        
        response = self.session.get(f"{BASE_URL}/api/review/config/{form_id}")
        
        assert response.status_code == 200
        data = response.json()
        assert "form_id" in data or "config" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
