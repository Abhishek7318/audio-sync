import unittest
import sys
import os
import io
from pathlib import Path
from PIL import Image

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.image_service import image_service
from app.models.project import Project, Scene

class TestImageService(unittest.TestCase):
    def test_aspect_ratio_resolutions(self):
        w16, h16 = image_service._get_target_resolution("16:9")
        self.assertEqual((w16, h16), (1920, 1080))

        w9, h9 = image_service._get_target_resolution("9:16")
        self.assertEqual((w9, h9), (1080, 1920))

        w1, h1 = image_service._get_target_resolution("1:1")
        self.assertEqual((w1, h1), (1080, 1080))

    def test_image_optimization_and_cropping(self):
        # Create a dummy test image in memory
        img = Image.new("RGB", (800, 600), color=(120, 50, 200))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")

        output_path = Path("test_output_img.png")
        try:
            saved_path = image_service.optimize_and_save_image(img_bytes.getvalue(), output_path, "16:9")
            self.assertTrue(output_path.exists())

            with Image.open(saved_path) as saved_img:
                self.assertEqual(saved_img.size, (1920, 1080))
        finally:
            if output_path.exists():
                output_path.unlink()

    def test_bulk_number_matcher(self):
        import re
        filenames = ["scene_01.png", "img_2.jpg", "03_temple.webp", "extra.png"]
        matched_numbers = []
        for f in filenames:
            m = re.search(r'(\d+)', f)
            if m:
                matched_numbers.append(int(m.group(1)))
        self.assertEqual(matched_numbers, [1, 2, 3])

if __name__ == "__main__":
    unittest.main()
