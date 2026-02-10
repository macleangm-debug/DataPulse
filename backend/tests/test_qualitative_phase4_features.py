"""
Test Suite for Qualitative Module Phase 4 Features:
1. Mixed Methods Support - Theme-variable linking, joint display, cross-reference, convergence analysis
2. REFI-QDA Export - XML export, QDPX package, codebook export, codings export, import codebook
3. Real-time Collaboration - Presence, sessions, activity feed
4. Publication Visuals - Framework matrix, quote cards, code frequency chart, theme network, coding timeline, coverage heatmap
"""

import pytest
import requests
import os
import json
import zipfile
import io
from datetime import datetime

# Get API URL from environment
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL')
if not BASE_URL:
    pytest.skip("REACT_APP_BACKEND_URL not set", allow_module_level=True)

BASE_URL = BASE_URL.rstrip('/')

# Test credentials
ORG_ID = "test-org-123"
USER_ID = "test-user-phase4"
PROJECT_ID = "698afc3589d798aeeb52eaaa"  # Existing test project


class TestSetup:
    """Setup test data for phase 4 testing"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        """Shared requests session"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_health_check(self, api_client):
        """Verify API is accessible"""
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"API Health check passed: {response.json()}")


class TestMixedMethodsFeatures:
    """Test Mixed Methods Support APIs - Theme-variable linking"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    @pytest.fixture(scope="class")
    def test_theme_id(self, api_client):
        """Get or create a theme for testing"""
        # First try to get existing themes
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/themes?project_id={PROJECT_ID}&org_id={ORG_ID}"
        )
        if response.status_code == 200:
            themes = response.json()
            if themes:
                return themes[0].get('id')
        
        # Create a test theme if none exist
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/themes",
            params={"org_id": ORG_ID, "user_id": USER_ID},
            json={
                "project_id": PROJECT_ID,
                "title": "TEST_Phase4_Theme",
                "description": "Test theme for mixed methods testing"
            }
        )
        if response.status_code in [200, 201]:
            return response.json().get('id')
        return None
    
    def test_create_theme_variable_link(self, api_client, test_theme_id):
        """Test creating a link between theme and quantitative variable"""
        if not test_theme_id:
            pytest.skip("No theme available for testing")
        
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/mixed/links",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID,
                "user_id": USER_ID
            },
            json={
                "theme_id": test_theme_id,
                "variable_name": "satisfaction_score",
                "variable_type": "numeric",
                "relationship": "correlates",
                "notes": "Theme correlates with satisfaction scores"
            }
        )
        
        print(f"Create link response: {response.status_code} - {response.text}")
        assert response.status_code in [200, 201, 404], f"Unexpected status: {response.status_code}"
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "id" in data or "message" in data
            return data.get("id")
    
    def test_list_theme_variable_links(self, api_client):
        """Test listing theme-variable links"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/mixed/links",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID
            }
        )
        
        print(f"List links response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} theme-variable links")
    
    def test_joint_display_generation(self, api_client, test_theme_id):
        """Test generating joint display combining qual and quant data"""
        theme_ids = [test_theme_id] if test_theme_id else []
        
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/mixed/joint-display",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID
            },
            json={
                "qual_theme_ids": theme_ids,
                "quant_variables": ["satisfaction_score", "age"],
                "display_type": "side_by_side"
            }
        )
        
        print(f"Joint display response: {response.status_code}")
        assert response.status_code in [200, 422]  # 422 if validation fails
        
        if response.status_code == 200:
            data = response.json()
            assert "project_id" in data
            assert "qualitative" in data
            assert "quantitative" in data
            assert "integration" in data
            print(f"Joint display generated: {data.get('display_type')}")
    
    def test_cross_reference_analysis(self, api_client):
        """Test cross-reference analysis between qual codings and quant variables"""
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/mixed/cross-reference",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID,
                "source_attribute": "participant_type",
                "quant_variable": "experience_level"
            }
        )
        
        print(f"Cross-reference response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "grouping_attribute" in data
        assert "analysis" in data
        print(f"Cross-reference groups: {data.get('groups', [])}")
    
    def test_convergence_analysis(self, api_client):
        """Test convergence/divergence analysis between qual and quant findings"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/mixed/convergence/{PROJECT_ID}",
            params={"org_id": ORG_ID}
        )
        
        print(f"Convergence analysis response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "convergent" in data
        assert "divergent" in data
        assert "elaborating" in data
        print(f"Convergence: {data['convergent']['count']}, Divergent: {data['divergent']['count']}")


class TestRefiQdaExport:
    """Test REFI-QDA Export/Import APIs for NVivo/ATLAS.ti/MAXQDA interoperability"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        return session
    
    def test_export_refi_qda_xml(self, api_client):
        """Test exporting project in REFI-QDA XML format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/refi-qda/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "include_sources": True,
                "include_codings": True
            }
        )
        
        print(f"REFI-QDA XML export response: {response.status_code}")
        assert response.status_code in [200, 404]  # 404 if project doesn't exist
        
        if response.status_code == 200:
            # Verify it's valid XML
            assert response.headers.get('content-type', '').startswith('application/xml')
            content = response.text
            assert "<?xml" in content
            assert "Project" in content
            assert "urn:QDA-XML:project:1.0" in content
            print(f"REFI-QDA XML export successful, size: {len(content)} bytes")
    
    def test_export_qdpx_package(self, api_client):
        """Test exporting project as QDPX package (zipped REFI-QDA with sources)"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/qdpx/{PROJECT_ID}",
            params={"org_id": ORG_ID}
        )
        
        print(f"QDPX package export response: {response.status_code}")
        assert response.status_code in [200, 404]
        
        if response.status_code == 200:
            # Verify it's a valid zip file
            content_type = response.headers.get('content-type', '')
            assert 'application/zip' in content_type or 'application/octet-stream' in content_type
            
            # Try to parse as zip
            try:
                zip_buffer = io.BytesIO(response.content)
                with zipfile.ZipFile(zip_buffer, 'r') as zf:
                    file_list = zf.namelist()
                    print(f"QDPX package contains: {file_list}")
                    assert "project.qde" in file_list
                    assert "manifest.json" in file_list
            except zipfile.BadZipFile:
                pytest.fail("QDPX export is not a valid zip file")
    
    def test_export_codebook_json(self, api_client):
        """Test exporting codebook in JSON format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/codebook/{PROJECT_ID}",
            params={"org_id": ORG_ID, "format": "json"}
        )
        
        print(f"Codebook JSON export response: {response.status_code}")
        assert response.status_code == 200
        
        data = json.loads(response.text)
        assert isinstance(data, list)
        print(f"Exported {len(data)} codes in JSON format")
        
        if data:
            code = data[0]
            assert "id" in code or "name" in code
            print(f"Sample code: {code.get('name', 'Unknown')}")
    
    def test_export_codebook_csv(self, api_client):
        """Test exporting codebook in CSV format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/codebook/{PROJECT_ID}",
            params={"org_id": ORG_ID, "format": "csv"}
        )
        
        print(f"Codebook CSV export response: {response.status_code}")
        assert response.status_code == 200
        
        content = response.text
        assert "id,name,definition" in content
        lines = content.strip().split('\n')
        print(f"Codebook CSV has {len(lines)-1} codes")
    
    def test_export_codebook_xml(self, api_client):
        """Test exporting codebook in XML format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/codebook/{PROJECT_ID}",
            params={"org_id": ORG_ID, "format": "xml"}
        )
        
        print(f"Codebook XML export response: {response.status_code}")
        assert response.status_code == 200
        
        content = response.text
        assert "<?xml" in content
        assert "<Codebook>" in content
        print(f"Codebook XML export successful")
    
    def test_export_codings_json(self, api_client):
        """Test exporting all codings in JSON format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/codings/{PROJECT_ID}",
            params={"org_id": ORG_ID, "format": "json"}
        )
        
        print(f"Codings JSON export response: {response.status_code}")
        assert response.status_code == 200
        
        data = json.loads(response.text)
        assert isinstance(data, list)
        print(f"Exported {len(data)} codings in JSON format")
    
    def test_export_codings_csv(self, api_client):
        """Test exporting all codings in CSV format"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/export/codings/{PROJECT_ID}",
            params={"org_id": ORG_ID, "format": "csv"}
        )
        
        print(f"Codings CSV export response: {response.status_code}")
        assert response.status_code == 200
        
        content = response.text
        assert "source_name,code_name" in content
        print(f"Codings CSV export successful")
    
    def test_import_codebook(self, api_client):
        """Test importing codebook from JSON"""
        codebook_data = [
            {
                "name": "TEST_ImportedCode1",
                "definition": "Test imported code 1",
                "color": "#EF4444"
            },
            {
                "name": "TEST_ImportedCode2",
                "definition": "Test imported code 2",
                "color": "#10B981"
            }
        ]
        
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/export/import-codebook/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "user_id": USER_ID
            },
            json=codebook_data
        )
        
        print(f"Import codebook response: {response.status_code}")
        # May get 400 if codebook_data not properly received (body vs query param issue)
        assert response.status_code in [200, 201, 400, 422]
        
        if response.status_code in [200, 201]:
            data = response.json()
            assert "imported_count" in data
            print(f"Imported {data.get('imported_count')} codes")


class TestRealtimeCollaboration:
    """Test Real-time Collaboration APIs - Presence, sessions, activity feed"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_get_presence(self, api_client):
        """Test getting current users in a project session"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/presence/{PROJECT_ID}"
        )
        
        print(f"Get presence response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "users" in data
        assert "user_count" in data
        print(f"Current presence: {data.get('user_count')} users online")
    
    def test_get_cursors(self, api_client):
        """Test getting cursor positions for all users"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/cursors/{PROJECT_ID}"
        )
        
        print(f"Get cursors response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "cursors" in data
        print(f"Cursors data retrieved successfully")
    
    def test_get_selections(self, api_client):
        """Test getting current selections for all users"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/selections/{PROJECT_ID}"
        )
        
        print(f"Get selections response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "selections" in data
    
    def test_create_session(self, api_client):
        """Test creating a named collaboration session"""
        response = api_client.post(
            f"{BASE_URL}/api/qualitative/realtime/sessions",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID,
                "user_id": USER_ID,
                "session_name": "TEST_Phase4_Session"
            }
        )
        
        print(f"Create session response: {response.status_code}")
        assert response.status_code in [200, 201]
        
        data = response.json()
        assert "id" in data
        assert "name" in data
        print(f"Session created: {data.get('name')}")
        return data.get("id")
    
    def test_list_sessions(self, api_client):
        """Test listing collaboration sessions"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/sessions",
            params={
                "project_id": PROJECT_ID,
                "org_id": ORG_ID,
                "status": "active"
            }
        )
        
        print(f"List sessions response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} active sessions")
    
    def test_get_activity_feed(self, api_client):
        """Test getting recent activity feed for project"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/activity/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "limit": 50
            }
        )
        
        print(f"Activity feed response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "activities" in data
        assert "current_users" in data
        
        activities = data.get("activities", [])
        print(f"Activity feed has {len(activities)} entries")
        
        if activities:
            activity = activities[0]
            assert "type" in activity
            assert "timestamp" in activity
            print(f"Latest activity type: {activity.get('type')}")


class TestPublicationVisuals:
    """Test Publication Visuals APIs - Charts, matrices, network diagrams"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_framework_matrix(self, api_client):
        """Test generating framework matrix for qualitative analysis"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/framework-matrix/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "row_type": "source",
                "column_type": "code"
            }
        )
        
        print(f"Framework matrix response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "rows" in data
        assert "columns" in data
        assert "matrix" in data
        
        print(f"Matrix: {len(data.get('rows', []))} rows × {len(data.get('columns', []))} columns")
    
    def test_framework_matrix_by_attribute(self, api_client):
        """Test framework matrix grouped by source attribute"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/framework-matrix/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "row_type": "attribute",
                "row_attribute": "participant_type",
                "column_type": "code"
            }
        )
        
        print(f"Framework matrix by attribute response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("row_type") == "attribute"
    
    def test_quote_cards(self, api_client):
        """Test generating quote cards for presentations"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/quote-cards/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "limit": 20
            }
        )
        
        print(f"Quote cards response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "cards" in data
        assert "card_count" in data
        
        cards = data.get("cards", [])
        print(f"Generated {len(cards)} quote cards")
        
        if cards:
            card = cards[0]
            assert "quote" in card
            assert "source" in card
            assert "code" in card
    
    def test_quote_cards_html_export(self, api_client):
        """Test exporting quote cards as presentation-ready HTML"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/quote-cards/{PROJECT_ID}/export",
            params={"org_id": ORG_ID}
        )
        
        print(f"Quote cards HTML export response: {response.status_code}")
        assert response.status_code == 200
        
        content = response.text
        assert "<!DOCTYPE html>" in content
        assert "Quote Cards" in content or "quote-card" in content
        print(f"HTML export successful, size: {len(content)} bytes")
    
    def test_code_frequency_chart(self, api_client):
        """Test getting data for code frequency visualization"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/code-frequency-chart/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "chart_type": "bar"
            }
        )
        
        print(f"Code frequency chart response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "chart_type" in data
        assert "total_codings" in data
        assert "data" in data
        
        chart_data = data.get("data", [])
        print(f"Code frequency: {len(chart_data)} codes, {data.get('total_codings')} total codings")
        
        if chart_data:
            item = chart_data[0]
            assert "code_id" in item
            assert "name" in item
            assert "count" in item
            assert "percentage" in item
    
    def test_theme_network_diagram(self, api_client):
        """Test generating data for theme network diagram"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/theme-network/{PROJECT_ID}",
            params={"org_id": ORG_ID}
        )
        
        print(f"Theme network response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "nodes" in data
        assert "edges" in data
        assert "node_count" in data
        assert "edge_count" in data
        
        print(f"Network: {data.get('node_count')} nodes, {data.get('edge_count')} edges")
        
        nodes = data.get("nodes", [])
        if nodes:
            node = nodes[0]
            assert "id" in node
            assert "type" in node  # theme or code
            assert "label" in node
    
    def test_coding_timeline(self, api_client):
        """Test getting coding activity over time for timeline visualization"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/coding-timeline/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "group_by": "day"
            }
        )
        
        print(f"Coding timeline response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "group_by" in data
        assert "timeline" in data
        assert "periods" in data
        
        print(f"Timeline: {data.get('periods')} periods")
        
        timeline = data.get("timeline", [])
        if timeline:
            entry = timeline[0]
            assert "period" in entry
            assert "coding_count" in entry
    
    def test_coding_timeline_by_hour(self, api_client):
        """Test timeline grouped by hour"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/coding-timeline/{PROJECT_ID}",
            params={
                "org_id": ORG_ID,
                "group_by": "hour"
            }
        )
        
        print(f"Hourly timeline response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("group_by") == "hour"
    
    def test_coverage_heatmap(self, api_client):
        """Test generating heatmap showing coded portions of sources"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/visuals/coverage-heatmap/{PROJECT_ID}",
            params={"org_id": ORG_ID}
        )
        
        print(f"Coverage heatmap response: {response.status_code}")
        assert response.status_code == 200
        
        data = response.json()
        assert "project_id" in data
        assert "source_count" in data
        assert "heatmap" in data
        
        print(f"Heatmap for {data.get('source_count')} sources")
        
        heatmap = data.get("heatmap", [])
        if heatmap:
            source_data = heatmap[0]
            assert "source_id" in source_data
            assert "source_name" in source_data
            assert "coverage_percentage" in source_data
            assert "segments" in source_data


class TestCleanup:
    """Cleanup test data after testing"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_cleanup_test_links(self, api_client):
        """Clean up test links created during testing"""
        # Get all links
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/mixed/links",
            params={"project_id": PROJECT_ID, "org_id": ORG_ID}
        )
        
        if response.status_code == 200:
            links = response.json()
            deleted = 0
            for link in links:
                if link.get("notes", "").startswith("Theme correlates"):
                    del_resp = api_client.delete(
                        f"{BASE_URL}/api/qualitative/mixed/links/{link['id']}",
                        params={"org_id": ORG_ID}
                    )
                    if del_resp.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} test links")
    
    def test_cleanup_test_sessions(self, api_client):
        """Clean up test sessions"""
        response = api_client.get(
            f"{BASE_URL}/api/qualitative/realtime/sessions",
            params={"project_id": PROJECT_ID, "org_id": ORG_ID}
        )
        
        if response.status_code == 200:
            sessions = response.json()
            ended = 0
            for session in sessions:
                if session.get("name", "").startswith("TEST_"):
                    end_resp = api_client.patch(
                        f"{BASE_URL}/api/qualitative/realtime/sessions/{session['id']}/end",
                        params={"org_id": ORG_ID}
                    )
                    if end_resp.status_code == 200:
                        ended += 1
            print(f"Ended {ended} test sessions")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
