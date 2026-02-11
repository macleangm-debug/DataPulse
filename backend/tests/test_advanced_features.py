"""
Test Advanced Features for DataPulse:
1. Cascading Selects - filtered dropdown chains
2. Sensor Metadata Collection - device sensors (battery, GPS, accelerometer)
3. Server Datasets - versioning, snapshots, real-time updates
4. Nested repeat groups - repeats within repeats
"""
import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test data
ORG_ID = "09872b0e-9cb6-4aac-b46d-54a709c7f4b6"
TEST_FORM_ID = "679a763e-f27e-4b79-aa56-8d564e32381c"
TEST_CASCADE_CONFIG_ID = "f17d6a1b-a3e8-4f5b-9b9a-f7f573f90e48"


class TestAuth:
    """Authentication for all tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "demo@datapulse.io",
            "password": "Test123!"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestCascadingSelects(TestAuth):
    """Test cascading select field functionality"""
    
    cascade_config_id = None
    
    def test_01_create_cascade_config(self, auth_headers):
        """Test creating a cascade configuration"""
        cascade_data = {
            "name": "Location Cascade Test",
            "description": "Test cascading select for country > region > city",
            "levels": [
                {
                    "field_name": "country",
                    "label": "Country",
                    "parent_field": None,
                    "options": [
                        {"value": "ke", "label": "Kenya"},
                        {"value": "tz", "label": "Tanzania"},
                        {"value": "ug", "label": "Uganda"}
                    ]
                },
                {
                    "field_name": "region",
                    "label": "Region",
                    "parent_field": "country",
                    "options": [
                        {"value": "nairobi", "label": "Nairobi", "parent_value": "ke"},
                        {"value": "mombasa", "label": "Mombasa", "parent_value": "ke"},
                        {"value": "dar", "label": "Dar es Salaam", "parent_value": "tz"},
                        {"value": "arusha", "label": "Arusha", "parent_value": "tz"},
                        {"value": "kampala", "label": "Kampala", "parent_value": "ug"}
                    ]
                },
                {
                    "field_name": "city",
                    "label": "City/District",
                    "parent_field": "region",
                    "options": [
                        {"value": "westlands", "label": "Westlands", "parent_value": "nairobi"},
                        {"value": "karen", "label": "Karen", "parent_value": "nairobi"},
                        {"value": "likoni", "label": "Likoni", "parent_value": "mombasa"},
                        {"value": "kinondoni", "label": "Kinondoni", "parent_value": "dar"},
                        {"value": "ilala", "label": "Ilala", "parent_value": "dar"}
                    ]
                }
            ],
            "allow_other": True,
            "search_enabled": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/cascades?org_id={ORG_ID}",
            json=cascade_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to create cascade: {response.text}"
        data = response.json()
        assert "id" in data
        TestCascadingSelects.cascade_config_id = data["id"]
        print(f"Created cascade config: {data['id']}")
    
    def test_02_get_cascade_config(self, auth_headers):
        """Test getting cascade configuration"""
        config_id = TestCascadingSelects.cascade_config_id or TEST_CASCADE_CONFIG_ID
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/cascades/{config_id}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get cascade config: {response.text}"
        data = response.json()
        assert "levels" in data
        assert len(data["levels"]) >= 1
        print(f"Cascade config has {len(data['levels'])} levels")
    
    def test_03_get_cascade_root_options(self, auth_headers):
        """Test getting root level options (no parent filter)"""
        config_id = TestCascadingSelects.cascade_config_id or TEST_CASCADE_CONFIG_ID
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/cascades/{config_id}/options?level_index=0",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get root options: {response.text}"
        data = response.json()
        assert "options" in data
        print(f"Root level has {len(data['options'])} options")
    
    def test_04_get_cascade_filtered_options(self, auth_headers):
        """Test getting filtered options based on parent selection"""
        config_id = TestCascadingSelects.cascade_config_id or TEST_CASCADE_CONFIG_ID
        
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/cascades/{config_id}/options?level_index=1&parent_value=ke",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get filtered options: {response.text}"
        data = response.json()
        assert "options" in data
        # Should only get Kenya regions
        print(f"Filtered options for Kenya: {len(data['options'])} regions")
    
    def test_05_list_cascade_configs(self, auth_headers):
        """Test listing all cascade configurations for org"""
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/cascades?org_id={ORG_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to list cascades: {response.text}"
        data = response.json()
        assert "configs" in data
        print(f"Organization has {len(data['configs'])} cascade configs")


class TestSensorMetadata(TestAuth):
    """Test sensor metadata collection functionality"""
    
    def test_01_get_sensor_config(self, auth_headers):
        """Test getting sensor collection configuration for a form"""
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/sensors/config/{TEST_FORM_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get sensor config: {response.text}"
        data = response.json()
        
        # Check default config fields
        assert "collect_battery" in data
        assert "collect_gps" in data
        assert "collect_accelerometer" in data
        assert "collect_network" in data
        print(f"Sensor config: battery={data['collect_battery']}, gps={data['collect_gps']}, accelerometer={data['collect_accelerometer']}")
    
    def test_02_record_sensor_metadata(self, auth_headers):
        """Test recording sensor metadata for a submission"""
        submission_id = f"test-submission-{uuid.uuid4()}"
        
        sensor_data = {
            "submission_id": submission_id,
            "form_id": TEST_FORM_ID,
            "timestamp": datetime.utcnow().isoformat(),
            "device_info": {
                "userAgent": "Mozilla/5.0 Test",
                "platform": "Linux",
                "language": "en-US",
                "cookiesEnabled": True,
                "online": True,
                "screen": {
                    "width": 1920,
                    "height": 1080,
                    "colorDepth": 24,
                    "orientation": "landscape"
                }
            },
            "battery": {
                "level": 75,
                "charging": False,
                "chargingTime": None,
                "dischargingTime": 14400
            },
            "network": {
                "online": True,
                "type": "4g",
                "downlink": 10,
                "rtt": 50,
                "saveData": False
            },
            "location": {
                "latitude": -1.2921,
                "longitude": 36.8219,
                "accuracy": 10.5,
                "altitude": 1660,
                "altitudeAccuracy": 5,
                "heading": None,
                "speed": 0,
                "timestamp": 1707654321000
            },
            "accelerometer": {
                "samples": 10,
                "average": {"x": 0.1, "y": 9.8, "z": 0.2},
                "max": {"x": 0.5, "y": 10.1, "z": 0.8}
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advanced-fields/sensors/metadata",
            json=sensor_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to record sensor metadata: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Recorded sensor metadata: {data['id']}")
    
    def test_03_update_sensor_config(self, auth_headers):
        """Test updating sensor configuration for a form"""
        config_data = {
            "form_id": TEST_FORM_ID,
            "collect_battery": True,
            "collect_gps": True,
            "collect_accelerometer": True,  # Enable accelerometer
            "collect_network": True,
            "gps_interval_seconds": 15,  # More frequent GPS
            "accelerometer_sample_rate": 20  # 20 Hz
        }
        
        response = requests.put(
            f"{BASE_URL}/api/advanced-fields/sensors/config/{TEST_FORM_ID}",
            json=config_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to update sensor config: {response.text}"
        
        # Verify update
        response = requests.get(
            f"{BASE_URL}/api/advanced-fields/sensors/config/{TEST_FORM_ID}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["collect_accelerometer"] == True
        assert data["gps_interval_seconds"] == 15
        print("Sensor config updated successfully")


class TestDatasetVersioning(TestAuth):
    """Test dataset versioning, snapshots, and real-time updates"""
    
    dataset_id = None
    snapshot_id = None
    
    def test_01_create_dataset(self, auth_headers):
        """Test creating a lookup dataset"""
        dataset_data = {
            "name": f"Test Location Dataset {uuid.uuid4().hex[:8]}",
            "description": "Test dataset for versioning",
            "dataset_type": "location_hierarchy",
            "org_id": ORG_ID,
            "columns": [
                {"name": "id", "type": "string", "label": "ID", "required": True},
                {"name": "name", "type": "string", "label": "Name", "searchable": True, "required": True},
                {"name": "code", "type": "string", "label": "Code"},
                {"name": "level", "type": "string", "label": "Level"},
                {"name": "parent_id", "type": "string", "label": "Parent ID"}
            ],
            "hierarchy_config": {
                "levels": ["country", "region", "district", "village"]
            },
            "enable_offline": True,
            "offline_subset_field": "region",
            "searchable_fields": ["name", "code"],
            "display_field": "name",
            "value_field": "id"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/",
            json=dataset_data,
            headers=auth_headers
        )
        assert response.status_code in [200, 201], f"Failed to create dataset: {response.text}"
        data = response.json()
        assert "dataset_id" in data
        TestDatasetVersioning.dataset_id = data["dataset_id"]
        print(f"Created dataset: {data['dataset_id']}")
    
    def test_02_add_records_to_dataset(self, auth_headers):
        """Test adding records to dataset"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        records = [
            {"id": "country_ke", "name": "Kenya", "code": "KE", "level": "country", "parent_id": None},
            {"id": "region_nairobi", "name": "Nairobi", "code": "NBI", "level": "region", "parent_id": "country_ke"},
            {"id": "district_westlands", "name": "Westlands", "code": "WL", "level": "district", "parent_id": "region_nairobi"}
        ]
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/records/bulk",
            json={"records": records, "replace_existing": True},
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to add records: {response.text}"
        data = response.json()
        assert data["total_records"] >= len(records)
        print(f"Added {len(records)} records, total: {data['total_records']}")
    
    def test_03_create_version_snapshot(self, auth_headers):
        """Test creating a version snapshot"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        snapshot_data = {
            "version": 1,
            "snapshot_name": "Initial Snapshot",
            "notes": "Test snapshot for versioning"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/versions/snapshot",
            json=snapshot_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to create snapshot: {response.text}"
        data = response.json()
        assert "id" in data
        TestDatasetVersioning.snapshot_id = data["id"]
        print(f"Created snapshot: {data['id']}, records: {data['record_count']}")
    
    def test_04_get_version_history(self, auth_headers):
        """Test getting version history"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        response = requests.get(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/versions/history",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get version history: {response.text}"
        data = response.json()
        assert "current_version" in data
        assert "snapshots" in data
        print(f"Version history: current v{data['current_version']}, {len(data['snapshots'])} snapshots")
    
    def test_05_get_dataset_stats(self, auth_headers):
        """Test getting dataset statistics"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        response = requests.get(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/stats",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to get dataset stats: {response.text}"
        data = response.json()
        assert "total_records" in data
        assert "active_records" in data
        assert "column_stats" in data
        print(f"Dataset stats: {data['total_records']} total, {data['active_records']} active records")
    
    def test_06_publish_realtime_update(self, auth_headers):
        """Test publishing a real-time update"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        update_data = {
            "record_id": "district_westlands",
            "action": "update",
            "data": {"name": "Westlands Updated", "population": 250000}
        }
        
        response = requests.post(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/realtime/publish",
            json=update_data,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to publish update: {response.text}"
        data = response.json()
        assert "id" in data
        print(f"Published realtime update: {data['id']}")
    
    def test_07_poll_realtime_updates(self, auth_headers):
        """Test polling for real-time updates"""
        dataset_id = TestDatasetVersioning.dataset_id
        if not dataset_id:
            pytest.skip("No dataset created")
        
        response = requests.get(
            f"{BASE_URL}/api/datasets/{ORG_ID}/{dataset_id}/realtime/poll",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed to poll updates: {response.text}"
        data = response.json()
        assert "updates" in data
        print(f"Polled {data['count']} realtime updates")


class TestFrontendFieldTypes:
    """Test that frontend shows correct field types"""
    
    def test_field_types_include_cascade(self):
        """Verify 'cascade' field type is defined in FormBuilderPage"""
        # This is a static check - we verify it exists in the component
        expected_types = ['text', 'number', 'textarea', 'date', 'select', 'cascade', 
                         'radio', 'checkbox', 'gps', 'photo', 'audio', 'video',
                         'barcode', 'signature', 'note', 'calculate', 'group', 
                         'repeat', 'nested_repeat']
        
        # Read the FormBuilderPage to verify
        with open('/app/frontend/src/pages/FormBuilderPage.jsx', 'r') as f:
            content = f.read()
        
        for field_type in ['cascade', 'nested_repeat']:
            assert f"type: '{field_type}'" in content, f"Field type '{field_type}' not found in FormBuilderPage"
        
        print("Frontend field types verified: cascade and nested_repeat present")
    
    def test_cascading_select_component_exists(self):
        """Verify CascadingSelect component exists"""
        with open('/app/frontend/src/components/CascadingSelect.jsx', 'r') as f:
            content = f.read()
        
        assert "CascadingSelect" in content
        assert "cascade_levels" in content
        assert "handleSelection" in content
        print("CascadingSelect component verified")
    
    def test_nested_repeat_component_exists(self):
        """Verify NestedRepeatGroup component exists"""
        with open('/app/frontend/src/components/CascadingSelect.jsx', 'r') as f:
            content = f.read()
        
        assert "NestedRepeatGroup" in content
        assert "nested_settings" in content
        print("NestedRepeatGroup component verified")
    
    def test_sensor_metadata_component_exists(self):
        """Verify SensorMetadataCollector component exists"""
        with open('/app/frontend/src/components/SensorMetadata.jsx', 'r') as f:
            content = f.read()
        
        assert "SensorMetadataCollector" in content
        assert "collectBatteryStatus" in content
        assert "collectLocation" in content
        assert "collectAccelerometer" in content
        print("SensorMetadataCollector component verified")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
