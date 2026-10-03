import unittest
import sys
import os
import tempfile
import asyncio
from pathlib import Path
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.video_gen_service import video_gen_service
from app.models.project import Project, Scene, CameraMotion

class TestVideoGenService(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.img_path = Path(self.temp_dir) / "test_img.png"
        img = Image.new("RGB", (1920, 1080), color=(100, 150, 200))
        img.save(self.img_path)

    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_procedural_motion_render(self):
        out_clip = Path(self.temp_dir) / "scene_001_motion.mp4"
        async def run_render():
            return await video_gen_service.render_procedural_motion_clip(
                image_path=self.img_path,
                output_clip_path=out_clip,
                duration=2.0,
                aspect_ratio="16:9",
                motion_type="zoom_in",
                particle_effect="fire_embers",
                fps=24
            )

        res = asyncio.run(run_render())
        self.assertTrue(os.path.exists(res))
        self.assertTrue(os.path.getsize(res) > 1000)

if __name__ == "__main__":
    unittest.main()
