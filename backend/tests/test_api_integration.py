import unittest
import sys
import os
import json
from pathlib import Path
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app
from app.models.project import Project

class TestApiIntegration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "online")

    def test_settings_endpoints(self):
        res = self.client.get("/api/settings")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("llm_provider", data)

        # Update settings
        data["llm_provider"] = "gemini"
        save_res = self.client.post("/api/settings", json=data)
        self.assertEqual(save_res.status_code, 200)

    def test_project_crud_lifecycle(self):
        new_project = {
            "name": "Integration Test Story",
            "language": "Hindi",
            "aspect_ratio": "16:9",
            "resolution_preset": "1080p",
            "fps": 30,
            "story_raw_text": "यह एक परीक्षण कहानी है।"
        }
        create_res = self.client.post("/api/projects", json=new_project)
        self.assertEqual(create_res.status_code, 200)
        proj_data = create_res.json()
        proj_id = proj_data["id"]
        self.assertEqual(proj_data["name"], "Integration Test Story")

        # Fetch project
        get_res = self.client.get(f"/api/projects/{proj_id}")
        self.assertEqual(get_res.status_code, 200)

        # Update project
        proj_data["story_raw_text"] = "यह एक अद्यतन परीक्षण कहानी है।"
        put_res = self.client.put(f"/api/projects/{proj_id}", json=proj_data)
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["story_raw_text"], "यह एक अद्यतन परीक्षण कहानी है।")

        # Delete project
        del_res = self.client.delete(f"/api/projects/{proj_id}")
        self.assertEqual(del_res.status_code, 200)

if __name__ == "__main__":
    unittest.main()
