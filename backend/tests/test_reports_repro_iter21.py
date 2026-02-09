"""
Iteration 21 - Report Builder and Reproducibility Pack Tests
Tests PDF, Word, HTML generation and Reproducibility Pack creation/download
"""
import pytest
import requests
import os
import json

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "demo@datapulse.io"
TEST_PASSWORD = "Test123!"
TEST_ORG_ID = "a07e901a-bd5f-450d-8533-ed4f7ec629a5"
EXISTING_REPORT_ID = "15a949f1-6761-4e2f-a508-859c8f2a0ccf"
EXISTING_PACK_ID = "61ba5897-8bc3-4b10-aa0e-18dbf694956e"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture
def api_headers(auth_token):
    """Get headers with auth token"""
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {auth_token}"
    }


# ===================== REPORT BUILDER TESTS =====================

class TestReportTemplates:
    """Test report templates API"""
    
    def test_list_templates(self, api_headers):
        """List available report templates"""
        response = requests.get(
            f"{BASE_URL}/api/reports/templates/{TEST_ORG_ID}",
            headers=api_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        templates = response.json()
        assert isinstance(templates, list), "Templates should be a list"
        
        # Should have at least default templates
        if templates:
            template = templates[0]
            assert "name" in template
            print(f"Found {len(templates)} templates")


class TestReportCRUD:
    """Test report CRUD operations"""
    
    @pytest.fixture(autouse=True)
    def setup(self, api_headers):
        self.api_headers = api_headers
        self.created_report_id = None
    
    def test_create_report(self, api_headers):
        """Create a new report"""
        report_data = {
            "org_id": TEST_ORG_ID,
            "title": "TEST_Iteration21_Report",
            "subtitle": "Automated test report",
            "author": "Test Agent",
            "sections": [
                {"type": "text", "title": "Introduction", "content": "This is a test report."},
                {"type": "text", "title": "Findings", "content": "## Key Results\n\n- Finding 1\n- Finding 2"}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reports",
            headers=api_headers,
            json=report_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "id" in result, "Response should contain report id"
        self.created_report_id = result["id"]
        print(f"Created report: {self.created_report_id}")
        return result["id"]
    
    def test_list_reports(self, api_headers):
        """List reports for organization"""
        response = requests.get(
            f"{BASE_URL}/api/reports/{TEST_ORG_ID}",
            headers=api_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        reports = response.json()
        assert isinstance(reports, list), "Reports should be a list"
        print(f"Found {len(reports)} reports")
        
        # Check if we have any test reports
        test_reports = [r for r in reports if r.get("title", "").startswith("TEST_")]
        print(f"Found {len(test_reports)} test reports")


class TestReportGeneration:
    """Test report generation in different formats (PDF, Word, HTML)"""
    
    @pytest.fixture
    def test_report_id(self, api_headers):
        """Create a test report for generation tests"""
        report_data = {
            "org_id": TEST_ORG_ID,
            "title": "TEST_Generation_Report",
            "subtitle": "Testing PDF/Word/HTML export",
            "author": "Test Agent",
            "sections": [
                {"type": "text", "title": "Executive Summary", "content": "This report summarizes key findings from the analysis."},
                {"type": "table", "title": "Key Metrics", "data": {
                    "columns": ["Metric", "Value"],
                    "rows": [
                        {"Metric": "Total Responses", "Value": "1500"},
                        {"Metric": "Completion Rate", "Value": "85%"}
                    ]
                }},
                {"type": "text", "title": "Conclusions", "content": "The analysis shows positive trends."}
            ]
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reports",
            headers=api_headers,
            json=report_data
        )
        assert response.status_code == 200
        return response.json()["id"]
    
    def test_generate_pdf_report(self, api_headers, test_report_id):
        """Generate PDF report using reportlab"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate",
            headers=api_headers,
            json={
                "report_id": test_report_id,
                "format": "pdf",
                "include_appendix": True,
                "include_methodology": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "application/pdf" in content_type, f"Expected PDF content type, got: {content_type}"
        
        # Check PDF magic bytes (should start with %PDF)
        content = response.content
        assert content[:4] == b'%PDF', f"PDF should start with %PDF magic bytes, got: {content[:20]}"
        print(f"PDF generated successfully, size: {len(content)} bytes")
    
    def test_generate_word_report(self, api_headers, test_report_id):
        """Generate Word (docx) report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate",
            headers=api_headers,
            json={
                "report_id": test_report_id,
                "format": "docx",
                "include_appendix": True,
                "include_methodology": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "openxmlformats" in content_type.lower() or "octet-stream" in content_type.lower(), f"Expected DOCX content type, got: {content_type}"
        
        # Check DOCX magic bytes (ZIP file format, starts with PK)
        content = response.content
        assert content[:2] == b'PK', f"DOCX should start with PK (ZIP) magic bytes, got: {content[:20]}"
        print(f"Word document generated successfully, size: {len(content)} bytes")
    
    def test_generate_html_report(self, api_headers, test_report_id):
        """Generate HTML report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate",
            headers=api_headers,
            json={
                "report_id": test_report_id,
                "format": "html",
                "include_appendix": True,
                "include_methodology": True
            }
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "text/html" in content_type, f"Expected HTML content type, got: {content_type}"
        
        # Check HTML content
        content = response.text
        assert "<!DOCTYPE html>" in content or "<html" in content, "Response should be valid HTML"
        assert "TEST_Generation_Report" in content or "report" in content.lower(), "HTML should contain report content"
        print(f"HTML report generated successfully, size: {len(content)} characters")
    
    def test_generate_invalid_format(self, api_headers, test_report_id):
        """Test error handling for invalid format"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate",
            headers=api_headers,
            json={
                "report_id": test_report_id,
                "format": "invalid_format"
            }
        )
        assert response.status_code == 400, f"Expected 400 for invalid format, got {response.status_code}"
    
    def test_generate_nonexistent_report(self, api_headers):
        """Test error handling for non-existent report"""
        response = requests.post(
            f"{BASE_URL}/api/reports/generate",
            headers=api_headers,
            json={
                "report_id": "nonexistent-report-id-12345",
                "format": "pdf"
            }
        )
        assert response.status_code == 404, f"Expected 404 for non-existent report, got {response.status_code}"


# ===================== REPRODUCIBILITY PACK TESTS =====================

class TestReproducibilityPackCRUD:
    """Test reproducibility pack creation and management"""
    
    def test_create_pack(self, api_headers):
        """Create a new reproducibility pack"""
        pack_data = {
            "org_id": TEST_ORG_ID,
            "name": "TEST_Iteration21_Pack",
            "description": "Automated test pack for iteration 21",
            "include_raw_data": True,
            "include_scripts": True,
            "anonymize": False
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reproducibility/pack",
            headers=api_headers,
            json=pack_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "pack_id" in result, "Response should contain pack_id"
        assert "hash" in result, "Response should contain hash for integrity"
        print(f"Created pack: {result['pack_id']}, hash: {result.get('hash', 'N/A')}")
        return result["pack_id"]
    
    def test_list_packs(self, api_headers):
        """List reproducibility packs for organization"""
        response = requests.get(
            f"{BASE_URL}/api/reproducibility/packs/{TEST_ORG_ID}",
            headers=api_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        packs = response.json()
        assert isinstance(packs, list), "Packs should be a list"
        print(f"Found {len(packs)} reproducibility packs")
        
        # Check pack structure
        if packs:
            pack = packs[0]
            assert "id" in pack
            assert "name" in pack
            assert "created_at" in pack
            print(f"Latest pack: {pack.get('name')}")
    
    def test_get_pack_details(self, api_headers):
        """Get pack details - use existing or create new"""
        # First try to get existing pack
        response = requests.get(
            f"{BASE_URL}/api/reproducibility/pack/{EXISTING_PACK_ID}",
            headers=api_headers
        )
        
        if response.status_code == 404:
            # Create a new pack if existing one doesn't exist
            pack_data = {
                "org_id": TEST_ORG_ID,
                "name": "TEST_Get_Details_Pack",
                "description": "Pack for details test",
                "include_raw_data": True
            }
            create_resp = requests.post(
                f"{BASE_URL}/api/reproducibility/pack",
                headers=api_headers,
                json=pack_data
            )
            assert create_resp.status_code == 200
            pack_id = create_resp.json()["pack_id"]
            
            response = requests.get(
                f"{BASE_URL}/api/reproducibility/pack/{pack_id}",
                headers=api_headers
            )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        pack = response.json()
        assert "id" in pack
        assert "org_id" in pack
        print(f"Pack details retrieved: {pack.get('name')}")


class TestReproducibilityPackDownload:
    """Test reproducibility pack download functionality"""
    
    @pytest.fixture
    def test_pack_id(self, api_headers):
        """Create a test pack for download tests"""
        pack_data = {
            "org_id": TEST_ORG_ID,
            "name": "TEST_Download_Pack",
            "description": "Pack for download testing",
            "include_raw_data": True,
            "include_scripts": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reproducibility/pack",
            headers=api_headers,
            json=pack_data
        )
        assert response.status_code == 200
        return response.json()["pack_id"]
    
    def test_download_pack_as_zip(self, api_headers, test_pack_id):
        """Download reproducibility pack as ZIP file"""
        response = requests.get(
            f"{BASE_URL}/api/reproducibility/pack/{test_pack_id}/download",
            headers=api_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Check content type
        content_type = response.headers.get("content-type", "")
        assert "application/zip" in content_type or "octet-stream" in content_type, f"Expected ZIP content type, got: {content_type}"
        
        # Check ZIP magic bytes (should start with PK)
        content = response.content
        assert content[:2] == b'PK', f"ZIP should start with PK magic bytes, got: {content[:20]}"
        print(f"ZIP pack downloaded successfully, size: {len(content)} bytes")
        
        # Verify it's a valid ZIP by checking structure
        import zipfile
        import io
        
        try:
            with zipfile.ZipFile(io.BytesIO(content), 'r') as zf:
                files = zf.namelist()
                print(f"ZIP contains {len(files)} files: {files[:5]}...")
                
                # Should contain expected files
                assert any("README" in f for f in files), "ZIP should contain README"
                assert any("metadata" in f or "pack_info" in f for f in files), "ZIP should contain metadata"
        except zipfile.BadZipFile:
            pytest.fail("Downloaded file is not a valid ZIP archive")
    
    def test_download_nonexistent_pack(self, api_headers):
        """Test error handling for non-existent pack download"""
        response = requests.get(
            f"{BASE_URL}/api/reproducibility/pack/nonexistent-pack-12345/download",
            headers=api_headers
        )
        assert response.status_code == 404, f"Expected 404 for non-existent pack, got {response.status_code}"


class TestReproducibilityPackWithAnonymization:
    """Test pack creation with anonymization option"""
    
    def test_create_anonymized_pack(self, api_headers):
        """Create pack with anonymization enabled"""
        pack_data = {
            "org_id": TEST_ORG_ID,
            "name": "TEST_Anonymized_Pack",
            "description": "Pack with PII anonymization",
            "include_raw_data": True,
            "anonymize": True
        }
        
        response = requests.post(
            f"{BASE_URL}/api/reproducibility/pack",
            headers=api_headers,
            json=pack_data
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        result = response.json()
        assert "pack_id" in result
        print(f"Created anonymized pack: {result['pack_id']}")


# ===================== CLEANUP =====================

class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_reports(self, api_headers):
        """Cleanup TEST_ prefixed reports"""
        # List reports
        response = requests.get(
            f"{BASE_URL}/api/reports/{TEST_ORG_ID}",
            headers=api_headers
        )
        if response.status_code == 200:
            reports = response.json()
            test_reports = [r for r in reports if r.get("title", "").startswith("TEST_")]
            
            for report in test_reports:
                del_resp = requests.delete(
                    f"{BASE_URL}/api/reports/{TEST_ORG_ID}/{report['id']}",
                    headers=api_headers
                )
                print(f"Deleted test report: {report['id']} - {del_resp.status_code}")
        
        print("Test reports cleanup complete")
    
    def test_cleanup_test_packs(self, api_headers):
        """Cleanup TEST_ prefixed packs"""
        # List packs
        response = requests.get(
            f"{BASE_URL}/api/reproducibility/packs/{TEST_ORG_ID}",
            headers=api_headers
        )
        if response.status_code == 200:
            packs = response.json()
            test_packs = [p for p in packs if p.get("name", "").startswith("TEST_")]
            
            for pack in test_packs:
                del_resp = requests.delete(
                    f"{BASE_URL}/api/reproducibility/pack/{pack['id']}",
                    headers=api_headers
                )
                print(f"Deleted test pack: {pack['id']} - {del_resp.status_code}")
        
        print("Test packs cleanup complete")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
