import unittest
import tempfile
import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.models.project import Project, Scene, StyleBible, CameraMotion
from app.services.settings_service import SettingsService
from app.models.settings import AppSettings

class TestProjectSchema(unittest.TestCase):
    def test_project_default_initialization(self):
        project = Project(name="Test Story Video", language="Hindi")
        self.assertEqual(project.name, "Test Story Video")
        self.assertEqual(project.language, "Hindi")
        self.assertEqual(project.aspect_ratio, "16:9")
        self.assertEqual(project.resolution_preset, "1080p")
        self.assertEqual(len(project.scenes), 0)
        self.assertEqual(project.current_step, 1)

    def test_scene_serialization(self):
        scene = Scene(
            scene_number=1,
            story_text="A misty temple stands on the mountain peak.",
            duration=6.5,
            location="Mountain Temple",
            mood="mysterious",
            camera_motion=CameraMotion(type="zoom_in", speed="slow"),
            image_prompt="Cinematic shot of ancient temple in morning fog"
        )
        self.assertEqual(scene.scene_number, 1)
        self.assertEqual(scene.camera_motion.type, "zoom_in")
        self.assertEqual(scene.camera_motion.speed, "slow")

    def test_settings_crypto(self):
        service = SettingsService()
        raw_key = "sk-test-secret-12345"
        encrypted = service._encrypt(raw_key)
        self.assertNotEqual(encrypted, raw_key)
        decrypted = service._decrypt(encrypted)
        self.assertEqual(decrypted, raw_key)

if __name__ == "__main__":
    unittest.main()
