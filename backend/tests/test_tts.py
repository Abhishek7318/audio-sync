import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.tts_service import tts_service, VOICE_CATALOG

class TestTTSService(unittest.TestCase):
    def test_voice_catalog_contains_hindi_and_english(self):
        voices = tts_service.get_voices()
        self.assertTrue(len(voices) >= 8)

        # Ensure Hindi voices exist
        hindi_voices = [v for v in voices if "Hindi" in v["language"]]
        self.assertTrue(len(hindi_voices) >= 2)
        hindi_ids = [v["id"] for v in hindi_voices]
        self.assertIn("hi-IN-MadhurNeural", hindi_ids)
        self.assertIn("hi-IN-SwaraNeural", hindi_ids)

        # Ensure English voices exist
        en_voices = [v for v in voices if "English" in v["language"]]
        self.assertTrue(len(en_voices) >= 2)

if __name__ == "__main__":
    unittest.main()
