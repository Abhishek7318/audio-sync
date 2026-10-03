import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.motion_service import motion_service
from app.models.project import Scene, CameraMotion

class TestMotionService(unittest.TestCase):
    def test_calculate_motion_crops(self):
        # Zoom in
        start, end = motion_service.calculate_motion_crops("zoom_in", "16:9", "medium", 1.25)
        self.assertEqual(start["w"], 1.0)
        self.assertEqual(start["h"], 1.0)
        self.assertAlmostEqual(end["w"], 1.0 / 1.25, places=3)
        self.assertAlmostEqual(end["h"], 1.0 / 1.25, places=3)

        # Pan left
        start_p, end_p = motion_service.calculate_motion_crops("pan_left", "16:9", "medium", 1.25)
        self.assertGreater(start_p["x"], end_p["x"])

        # Pan right
        start_r, end_r = motion_service.calculate_motion_crops("pan_right", "16:9", "medium", 1.25)
        self.assertLess(start_r["x"], end_r["x"])

    def test_ffmpeg_zoompan_expression(self):
        dummy_scene = Scene(
            id="s1",
            scene_number=1,
            story_text="Test scene",
            start_time=0.0,
            end_time=4.0,
            duration=4.0,
            location="City",
            time_of_day="Day",
            characters_present=[],
            mood="Dramatic",
            camera_shot="wide",
            camera_motion=CameraMotion(type="zoom_in", speed="medium", intensity=1.25),
            image_prompt="A test prompt",
            image_status="ready",
            transition_in="crossfade",
            transition_duration=0.5,
            visual_effects=[]
        )
        expr = motion_service.build_ffmpeg_zoompan_filter(dummy_scene, 1920, 1080, 30)
        self.assertIn("zoompan=", expr)
        self.assertIn("1920x1080", expr)
        self.assertIn("fps=30", expr)

    def test_timeline_recalculation(self):
        scenes = [
            Scene(
                id=f"s{i}",
                scene_number=i,
                story_text=f"Scene {i}",
                start_time=0.0,
                end_time=0.0,
                duration=3.0,
                location="Loc",
                time_of_day="Day",
                characters_present=[],
                mood="Mood",
                camera_shot="wide",
                camera_motion=CameraMotion(type="zoom_in", speed="medium", intensity=1.25),
                image_prompt="Prompt",
                image_status="ready",
                transition_in="cut",
                transition_duration=0.5,
                visual_effects=[]
            )
            for i in range(1, 4)
        ]
        recalculated = motion_service.recalculate_timeline_timestamps(scenes)
        self.assertEqual(recalculated[0].start_time, 0.0)
        self.assertEqual(recalculated[0].end_time, 3.0)
        self.assertEqual(recalculated[1].start_time, 3.0)
        self.assertEqual(recalculated[1].end_time, 6.0)
        self.assertEqual(recalculated[2].start_time, 6.0)
        self.assertEqual(recalculated[2].end_time, 9.0)

    def test_trim_scene_duration(self):
        scenes = [
            Scene(
                id=f"s{i}",
                scene_number=i,
                story_text=f"Scene {i}",
                start_time=0.0,
                end_time=0.0,
                duration=4.0 if i == 1 else 3.0,
                location="Loc",
                time_of_day="Day",
                characters_present=[],
                mood="Mood",
                camera_shot="wide",
                camera_motion=CameraMotion(type="zoom_in", speed="medium", intensity=1.25),
                image_prompt="Prompt",
                image_status="ready",
                transition_in="cut",
                transition_duration=0.5,
                visual_effects=[]
            )
            for i in range(1, 4)
        ]
        # Trim first scene from 4.0 to 6.5
        scenes[0].duration = 6.5
        recalculated = motion_service.recalculate_timeline_timestamps(scenes)
        self.assertEqual(recalculated[0].start_time, 0.0)
        self.assertEqual(recalculated[0].end_time, 6.5)
        self.assertEqual(recalculated[1].start_time, 6.5)
        self.assertEqual(recalculated[1].end_time, 9.5)
        self.assertEqual(recalculated[2].start_time, 9.5)
        self.assertEqual(recalculated[2].end_time, 12.5)

if __name__ == "__main__":
    unittest.main()
