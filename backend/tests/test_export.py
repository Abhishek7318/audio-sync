import unittest
from app.services.export_service import ExportService
from app.models.project import ExportSettings

class TestExportService(unittest.TestCase):
    def setUp(self):
        self.service = ExportService()

    def test_detect_hardware_encoder(self):
        encoder_info = self.service.detect_hardware_encoder()
        self.assertIn("encoder", encoder_info)
        self.assertIn("type", encoder_info)
        # On macOS, encoder should be h264_videotoolbox or libx264
        self.assertIn(encoder_info["encoder"], ["h264_videotoolbox", "h264_nvenc", "h264_amf", "libx264"])

    def test_get_preset_dimensions(self):
        # 16:9 Landscape
        w, h = self.service._get_preset_dimensions("youtube_1080p", "16:9")
        self.assertEqual((w, h), (1920, 1080))

        w, h = self.service._get_preset_dimensions("youtube_4k", "16:9")
        self.assertEqual((w, h), (3840, 2160))

        # 9:16 Shorts
        w, h = self.service._get_preset_dimensions("shorts_vertical", "9:16")
        self.assertEqual((w, h), (1080, 1920))

        # 1:1 Square
        w, h = self.service._get_preset_dimensions("square_social", "1:1")
        self.assertEqual((w, h), (1080, 1080))

    def test_export_settings_default_values(self):
        settings = ExportSettings()
        self.assertEqual(settings.preset, "youtube_1080p")
        self.assertEqual(settings.width, 1920)
        self.assertEqual(settings.height, 1080)
        self.assertEqual(settings.fps, 30)
        self.assertEqual(settings.target_lufs, -14.0)

if __name__ == "__main__":
    unittest.main()
