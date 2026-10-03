import unittest
from app.models.project import SubtitleCue, SubtitleStyle, WordTimestamp, Project
from app.services.subtitle_service import SubtitleService
from app.services.project_service import project_service

class TestSubtitleService(unittest.TestCase):
    def setUp(self):
        self.service = SubtitleService()
        self.sample_words = [
            WordTimestamp(word="Hello", start=0.0, end=0.4, probability=0.99),
            WordTimestamp(word="world", start=0.4, end=0.8, probability=0.98),
            WordTimestamp(word="this", start=0.8, end=1.1, probability=0.95),
            WordTimestamp(word="is", start=1.1, end=1.3, probability=0.99),
            WordTimestamp(word="AI", start=1.3, end=1.8, probability=0.97)
        ]
        self.sample_cues = [
            SubtitleCue(
                start_time=0.0,
                end_time=1.8,
                text="Hello world this is AI",
                words=self.sample_words
            ),
            SubtitleCue(
                start_time=2.0,
                end_time=4.5,
                text="Creating videos at lightning speed",
                words=[]
            )
        ]
        self.style = SubtitleStyle(
            mode="word_karaoke",
            font_family="Noto Sans Devanagari",
            font_size=48,
            primary_color="#FFFFFF",
            secondary_color="#FFD700",
            outline_color="#000000",
            outline_width=4,
            position="bottom",
            margin_v=60,
            uppercase=True
        )

    def test_format_srt_time(self):
        self.assertEqual(self.service.format_srt_time(0.0), "00:00:00,000")
        self.assertEqual(self.service.format_srt_time(65.456), "00:01:05,456")
        self.assertEqual(self.service.format_srt_time(3661.123), "01:01:01,123")

    def test_format_ass_time(self):
        self.assertEqual(self.service.format_ass_time(0.0), "0:00:00.00")
        self.assertEqual(self.service.format_ass_time(65.456), "0:01:05.46")
        self.assertEqual(self.service.format_ass_time(3661.12), "1:01:01.12")

    def test_hex_to_ass_color(self):
        # White #FFFFFF -> &H00FFFFFF
        self.assertEqual(self.service.hex_to_ass_color("#FFFFFF"), "&H00FFFFFF")
        # Red #FF0000 -> &H000000FF (ABGR)
        self.assertEqual(self.service.hex_to_ass_color("#FF0000"), "&H000000FF")
        # Blue #0000FF -> &H00FF0000 (ABGR)
        self.assertEqual(self.service.hex_to_ass_color("#0000FF"), "&H00FF0000")

    def test_generate_srt(self):
        srt = self.service.generate_srt(self.sample_cues)
        self.assertIn("1", srt)
        self.assertIn("00:00:00,000 --> 00:00:01,800", srt)
        self.assertIn("Hello world this is AI", srt)
        self.assertIn("2", srt)
        self.assertIn("00:00:02,000 --> 00:00:04,500", srt)
        self.assertIn("Creating videos at lightning speed", srt)

    def test_generate_ass(self):
        ass = self.service.generate_ass(self.sample_cues, self.style)
        self.assertIn("[Script Info]", ass)
        self.assertIn("[V4+ Styles]", ass)
        self.assertIn("Style: Default,Noto Sans Devanagari,48,", ass)
        self.assertIn("[Events]", ass)
        # Check karaoke tags {\k40}HELLO
        self.assertIn(r"{\k40}HELLO", ass)
        self.assertIn(r"{\k40}WORLD", ass)

    def test_split_and_merge_cues(self):
        project = Project(name="Subtitle Test Project")
        project = project_service.create_project(project)
        project.subtitles = [
            SubtitleCue(id="cue-1", start_time=0.0, end_time=4.0, text="First half and second half"),
            SubtitleCue(id="cue-2", start_time=4.0, end_time=8.0, text="Third part of sentence")
        ]
        project_service.save_project(project)

        # Test Split
        proj_split = self.service.split_cue(
            project.id,
            "cue-1",
            split_time=2.0,
            text_part1="First half",
            text_part2="and second half"
        )
        self.assertEqual(len(proj_split.subtitles), 3)
        self.assertEqual(proj_split.subtitles[0].text, "First half")
        self.assertEqual(proj_split.subtitles[0].end_time, 2.0)
        self.assertEqual(proj_split.subtitles[1].text, "and second half")
        self.assertEqual(proj_split.subtitles[1].start_time, 2.0)

        # Test Merge
        c0_id = proj_split.subtitles[0].id
        c1_id = proj_split.subtitles[1].id
        proj_merged = self.service.merge_cues(project.id, c0_id, c1_id)
        self.assertEqual(len(proj_merged.subtitles), 2)
        self.assertEqual(proj_merged.subtitles[0].text, "First half and second half")
        self.assertEqual(proj_merged.subtitles[0].start_time, 0.0)
        self.assertEqual(proj_merged.subtitles[0].end_time, 4.0)

        # Cleanup
        project_service.delete_project(project.id)

if __name__ == "__main__":
    unittest.main()
