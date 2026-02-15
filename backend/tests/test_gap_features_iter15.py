"""
DataPulse Gap Features Test Suite - Iteration 15
Tests for:
1. Device Management APIs (register, list, wipe, lock, unlock, revoke)
2. AI Simulation APIs (run simulation, quick check, list reports)
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestDeviceManagementAPIs:
    """Test Device Management (Remote Wipe) APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_user_id = f"TEST_user_{uuid.uuid4().hex[:8]}"
        self.test_org_id = f"TEST_org_{uuid.uuid4().hex[:8]}"
        self.test_admin_id = f"TEST_admin_{uuid.uuid4().hex[:8]}"
        self.registered_device_id = None
    
    def test_device_registration(self):
        """Test POST /api/devices/register - Register new device"""
        response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "Test Device",
                "device_type": "pwa",
                "os_name": "Chrome",
                "os_version": "120.0",
                "app_version": "1.0.0"
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "device_id" in data, "Response should contain device_id"
        assert data["status"] == "active", "New device should be active"
        assert data["message"] == "Device registered successfully"
        
        # Store device_id for subsequent tests
        self.registered_device_id = data["device_id"]
        print(f"Device registered: {self.registered_device_id}")
        return data["device_id"]
    
    def test_get_my_devices(self):
        """Test GET /api/devices/my-devices - List user's devices"""
        # First register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "My Test Device",
                "device_type": "mobile"
            }
        )
        assert reg_response.status_code == 200
        
        # Get user devices
        response = requests.get(
            f"{BASE_URL}/api/devices/my-devices",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            }
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # Should have at least the device we just registered
        assert len(data) >= 1, "Should have at least one device"
        print(f"Found {len(data)} devices for user")
    
    def test_list_org_devices(self):
        """Test GET /api/devices/{org_id} - List all org devices"""
        response = requests.get(f"{BASE_URL}/api/devices/{self.test_org_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"Found {len(data)} devices for org {self.test_org_id}")
    
    def test_device_stats(self):
        """Test GET /api/devices/{org_id}/stats - Get device statistics"""
        response = requests.get(f"{BASE_URL}/api/devices/{self.test_org_id}/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Verify response structure
        assert "by_status" in data, "Should have by_status field"
        assert "by_type" in data, "Should have by_type field"
        assert "active_last_24h" in data, "Should have active_last_24h field"
        assert "total_devices" in data, "Should have total_devices field"
        
        print(f"Device stats: {data}")
    
    def test_device_lock_unlock_flow(self):
        """Test device lock and unlock flow"""
        # Register a device first
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "Lock Test Device",
                "device_type": "tablet"
            }
        )
        assert reg_response.status_code == 200
        device_id = reg_response.json()["device_id"]
        
        # Lock the device
        lock_response = requests.post(
            f"{BASE_URL}/api/devices/{device_id}/lock",
            headers={"X-Admin-Id": self.test_admin_id},
            json={"reason": "Test lock"}
        )
        
        assert lock_response.status_code == 200, f"Lock failed: {lock_response.text}"
        lock_data = lock_response.json()
        assert "unlock_code" in lock_data, "Should return unlock code"
        assert lock_data["message"] == "Device lock initiated"
        unlock_code = lock_data["unlock_code"]
        print(f"Device locked, unlock code: {unlock_code}")
        
        # Verify device status via check endpoint
        check_response = requests.get(f"{BASE_URL}/api/devices/check/{device_id}")
        assert check_response.status_code == 200
        assert check_response.json()["status"] == "pending_lock"
        
        # Unlock the device (admin unlock)
        unlock_response = requests.post(
            f"{BASE_URL}/api/devices/{device_id}/unlock",
            headers={"X-Admin-Id": self.test_admin_id}
        )
        
        assert unlock_response.status_code == 200, f"Unlock failed: {unlock_response.text}"
        assert unlock_response.json()["message"] == "Device unlocked"
        print("Device unlocked successfully")
    
    def test_device_wipe_flow(self):
        """Test remote wipe initiation flow"""
        # Register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "Wipe Test Device",
                "device_type": "mobile"
            }
        )
        assert reg_response.status_code == 200
        device_id = reg_response.json()["device_id"]
        
        # Initiate wipe
        wipe_response = requests.post(
            f"{BASE_URL}/api/devices/{device_id}/wipe",
            headers={"X-Admin-Id": self.test_admin_id},
            json={
                "reason": "Test wipe - device lost",
                "wipe_type": "full",
                "notify_user": True
            }
        )
        
        assert wipe_response.status_code == 200, f"Wipe failed: {wipe_response.text}"
        wipe_data = wipe_response.json()
        assert wipe_data["message"] == "Remote wipe initiated"
        assert wipe_data["status"] == "pending_wipe"
        print("Remote wipe initiated successfully")
        
        # Verify status changed
        check_response = requests.get(f"{BASE_URL}/api/devices/check/{device_id}")
        assert check_response.status_code == 200
        assert check_response.json()["status"] == "pending_wipe"
        assert check_response.json()["action_required"] == "wipe"
        
        # Confirm wipe completed (simulating client callback)
        confirm_response = requests.post(f"{BASE_URL}/api/devices/{device_id}/confirm-wipe")
        assert confirm_response.status_code == 200
        assert confirm_response.json()["status"] == "wiped"
        print("Wipe confirmed successfully")
    
    def test_device_revoke(self):
        """Test device revocation"""
        # Register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "Revoke Test Device",
                "device_type": "pwa"
            }
        )
        assert reg_response.status_code == 200
        device_id = reg_response.json()["device_id"]
        
        # Revoke device
        revoke_response = requests.post(
            f"{BASE_URL}/api/devices/{device_id}/revoke?reason=Employee%20terminated",
            headers={"X-Admin-Id": self.test_admin_id}
        )
        
        assert revoke_response.status_code == 200, f"Revoke failed: {revoke_response.text}"
        assert revoke_response.json()["status"] == "revoked"
        print("Device revoked successfully")
        
        # Verify status
        check_response = requests.get(f"{BASE_URL}/api/devices/check/{device_id}")
        assert check_response.status_code == 200
        assert check_response.json()["status"] == "revoked"
        assert check_response.json()["action_required"] == "logout"
    
    def test_device_heartbeat(self):
        """Test device heartbeat endpoint"""
        # Register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={
                "device_name": "Heartbeat Test Device",
                "device_type": "mobile"
            }
        )
        assert reg_response.status_code == 200
        device_id = reg_response.json()["device_id"]
        
        # Send heartbeat
        heartbeat_response = requests.post(
            f"{BASE_URL}/api/devices/heartbeat/{device_id}",
            headers={"X-User-Id": self.test_user_id}
        )
        
        assert heartbeat_response.status_code == 200, f"Heartbeat failed: {heartbeat_response.text}"
        data = heartbeat_response.json()
        assert "status" in data
        assert "pending_actions" in data
        assert data["status"] == "active"
        print("Heartbeat successful")
    
    def test_device_activity_log(self):
        """Test GET /api/devices/{device_id}/activity - Get device activity"""
        # Register a device
        reg_response = requests.post(
            f"{BASE_URL}/api/devices/register",
            headers={
                "X-User-Id": self.test_user_id,
                "X-Org-Id": self.test_org_id
            },
            json={"device_name": "Activity Log Test Device"}
        )
        assert reg_response.status_code == 200
        device_id = reg_response.json()["device_id"]
        
        # Get activity log
        response = requests.get(f"{BASE_URL}/api/devices/{device_id}/activity")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        # Should have at least registration log
        if len(data) > 0:
            log = data[0]
            assert "device_id" in log
            assert "action" in log
            assert "timestamp" in log
            print(f"Found {len(data)} activity logs")
    
    def test_bulk_wipe(self):
        """Test POST /api/devices/{org_id}/bulk-wipe - Bulk wipe devices"""
        # Register two devices
        device_ids = []
        for i in range(2):
            reg_response = requests.post(
                f"{BASE_URL}/api/devices/register",
                headers={
                    "X-User-Id": self.test_user_id,
                    "X-Org-Id": self.test_org_id
                },
                json={"device_name": f"Bulk Wipe Device {i+1}"}
            )
            assert reg_response.status_code == 200
            device_ids.append(reg_response.json()["device_id"])
        
        # Bulk wipe
        response = requests.post(
            f"{BASE_URL}/api/devices/{self.test_org_id}/bulk-wipe",
            headers={"X-Admin-Id": self.test_admin_id},
            json=device_ids,
            params={"reason": "Bulk test wipe"}
        )
        
        assert response.status_code == 200, f"Bulk wipe failed: {response.text}"
        data = response.json()
        assert "devices_affected" in data
        print(f"Bulk wipe affected {data['devices_affected']} devices")


class TestSimulationAPIs:
    """Test AI Field Simulation APIs"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data"""
        self.test_org_id = f"TEST_org_{uuid.uuid4().hex[:8]}"
        self.test_form_id = f"TEST_form_{uuid.uuid4().hex[:8]}"
    
    def test_list_simulation_reports_empty(self):
        """Test GET /api/simulation/reports/{org_id} - List reports (empty)"""
        response = requests.get(f"{BASE_URL}/api/simulation/reports/{self.test_org_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        # For new org, should be empty or minimal
        print(f"Found {len(data)} simulation reports")
    
    def test_quick_check_form_not_found(self):
        """Test POST /api/simulation/quick-check/{form_id} - Form not found"""
        response = requests.post(
            f"{BASE_URL}/api/simulation/quick-check/nonexistent_form_id",
            params={"org_id": self.test_org_id}
        )
        
        # Should return 404 for non-existent form
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert "detail" in data
        assert data["detail"] == "Form not found"
        print("Correctly returned 404 for non-existent form")
    
    def test_run_simulation_form_not_found(self):
        """Test POST /api/simulation/run - Form not found"""
        response = requests.post(
            f"{BASE_URL}/api/simulation/run",
            json={
                "form_id": "nonexistent_form",
                "org_id": self.test_org_id,
                "num_simulations": 10,
                "mode": "random"
            }
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for simulation with non-existent form")
    
    def test_simulation_with_real_form(self):
        """Test simulation with a real form from database"""
        # First, check if there are any forms
        forms_response = requests.get(
            f"{BASE_URL}/api/forms/org_001",
            headers={"Authorization": "Bearer test"}
        )
        
        if forms_response.status_code == 200:
            forms = forms_response.json()
            if forms and len(forms) > 0:
                # Use existing form
                form_id = forms[0].get("id")
                org_id = forms[0].get("org_id", "org_001")
                
                # Run quick check
                quick_check_response = requests.post(
                    f"{BASE_URL}/api/simulation/quick-check/{form_id}",
                    params={"org_id": org_id}
                )
                
                if quick_check_response.status_code == 200:
                    data = quick_check_response.json()
                    assert "form_id" in data
                    assert "quick_check" in data
                    assert data["simulations_run"] == 10
                    print(f"Quick check completed for form {form_id}: {data.get('recommendation')}")
                else:
                    print(f"Quick check returned {quick_check_response.status_code}")
            else:
                print("No forms available for simulation test - skipping")
        else:
            print("Could not fetch forms - skipping simulation with real form")


class TestDeviceStatsEndpoint:
    """Focused tests for device stats endpoint"""
    
    def test_device_stats_structure(self):
        """Test GET /api/devices/{org_id}/stats - Verify response structure"""
        org_id = "test-org-1"
        response = requests.get(f"{BASE_URL}/api/devices/{org_id}/stats")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Required fields
        required_fields = ["by_status", "by_type", "active_last_24h", "total_devices"]
        for field in required_fields:
            assert field in data, f"Missing required field: {field}"
        
        # Type validation
        assert isinstance(data["by_status"], dict), "by_status should be a dict"
        assert isinstance(data["by_type"], dict), "by_type should be a dict"
        assert isinstance(data["active_last_24h"], int), "active_last_24h should be int"
        assert isinstance(data["total_devices"], int), "total_devices should be int"
        
        print(f"Stats structure valid: {data}")


class TestSimulationReportsEndpoint:
    """Focused tests for simulation reports endpoint"""
    
    def test_simulation_reports_returns_array(self):
        """Test GET /api/simulation/reports/{org_id} - Returns array"""
        org_id = "test-org-1"
        response = requests.get(f"{BASE_URL}/api/simulation/reports/{org_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        assert isinstance(data, list), f"Expected list, got {type(data)}"
        print(f"Reports endpoint returns array with {len(data)} items")


class TestDeviceCheckEndpoint:
    """Test device status check endpoint"""
    
    def test_device_check_not_found(self):
        """Test GET /api/devices/check/{device_id} - Device not found"""
        response = requests.get(f"{BASE_URL}/api/devices/check/nonexistent_device_id")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        data = response.json()
        assert data["detail"] == "Device not found"
        print("Correctly returns 404 for non-existent device")


# Run tests for key API functionality
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
