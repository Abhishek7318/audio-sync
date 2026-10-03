import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.llm_service import llm_service
from app.models.project import Project, CharacterProfile, StyleBible, AudioTrack

class TestLLMSceneBreakdown(unittest.TestCase):
    def test_character_bible_injection(self):
        vikram = CharacterProfile(
            name="Vikram",
            age_appearance="Late 20s, sharp jawline",
            physical_description="dark brown eyes, messy black hair",
            clothing_style="rugged charcoal leather jacket",
            key_colors=["charcoal", "indigo"]
        )
        characters = [vikram]
        desc = llm_service._get_character_description("Vikram", characters)
        self.assertIn("Late 20s, sharp jawline", desc)
        self.assertIn("dark brown eyes", desc)
        self.assertIn("charcoal leather jacket", desc)

    def test_style_suffix_generation(self):
        style_bible = StyleBible(
            preset_name="cinematic_realistic",
            lighting="dramatic chiaroscuro volumetric lighting",
            color_palette="rich amber and teal tones",
            camera_lens="35mm anamorphic lens",
            art_medium="photorealistic 8k digital photography"
        )
        suffix = llm_service._get_style_prompt_suffix(style_bible, "16:9")
        self.assertIn("--ar 16:9", suffix)
        self.assertIn("35mm anamorphic lens", suffix)
        self.assertIn("dramatic chiaroscuro", suffix)

    def test_different_presets_generate_different_prompts(self):
        anime_bible = StyleBible(
            preset_name="anime_ghibli",
            art_medium="Japanese anime illustration, Studio Ghibli aesthetic",
            lighting="vibrant god rays",
            color_palette="vibrant lush greens",
            camera_lens="anime cinematic composition"
        )
        pixar_bible = StyleBible(
            preset_name="3d_pixar",
            art_medium="3D Pixar Disney animation style, Octane render 3D",
            lighting="warm inviting studio key lighting",
            color_palette="rich cheerful palette",
            camera_lens="virtual 50mm animated lens"
        )
        watercolor_bible = StyleBible(
            preset_name="watercolor",
            art_medium="delicate watercolor painting on textured paper",
            lighting="soft diffuse morning wash",
            color_palette="dreamy pastel watercolors",
            camera_lens="storybook illustration composition"
        )

        p_anime = Project(story_raw_text="कहानी की शुरुआत", style_bible=anime_bible)
        p_pixar = Project(story_raw_text="कहानी की शुरुआत", style_bible=pixar_bible)
        p_water = Project(story_raw_text="कहानी की शुरुआत", style_bible=watercolor_bible)

        scenes_anime = llm_service._breakdown_local_smart(p_anime)
        scenes_pixar = llm_service._breakdown_local_smart(p_pixar)
        scenes_water = llm_service._breakdown_local_smart(p_water)

        self.assertTrue(len(scenes_anime) > 0)
        self.assertTrue(len(scenes_pixar) > 0)
        self.assertTrue(len(scenes_water) > 0)

        self.assertIn("Studio Ghibli", scenes_anime[0].image_prompt)
        self.assertIn("Pixar", scenes_pixar[0].image_prompt)
        self.assertIn("watercolor", scenes_water[0].image_prompt)
        self.assertNotEqual(scenes_anime[0].image_prompt, scenes_pixar[0].image_prompt)

    def test_youtube_explainer_2d_preset(self):
        explainer_bible = StyleBible(
            preset_name="youtube_explainer_2d",
        )
        p_explainer = Project(
            story_raw_text="आलू से सोना बनाने की अनोखी कहानी। रेस्टोरेंट में बासठ आइटम थे।",
            style_bible=explainer_bible
        )
        scenes = llm_service._breakdown_local_smart(p_explainer)
        self.assertTrue(len(scenes) > 0)
        self.assertIn("2D vector storyboard illustration", scenes[0].image_prompt)
        self.assertIn("clean black outlines", scenes[0].image_prompt)
        self.assertIn("modern YouTube explainer", scenes[0].image_prompt)

    def test_smart_heuristic_scene_breakdown(self):
        project = Project(
            name="The Sacred Temple",
            language="Hindi",
            story_raw_text="विक्रम जंगल के रास्ते से जा रहा था। अचानक उसे एक पुराना मंदिर दिखा। उसने दरवाजे को धक्का देकर खोला।",
            narration_audio=AudioTrack(duration=18.0),
            characters=[
                CharacterProfile(name="विक्रम", physical_description="युवा योद्धा, काली आँखें")
            ]
        )
        scenes = llm_service._breakdown_local_smart(project)
        self.assertTrue(len(scenes) >= 2)

        for s in scenes:
            self.assertTrue(s.duration >= 2.0)
            self.assertTrue(len(s.image_prompt) > 20)
            self.assertIn("--ar 16:9", s.image_prompt)
            self.assertIn(s.camera_shot, ["wide", "medium", "close_up", "over_shoulder", "aerial"])

if __name__ == "__main__":
    unittest.main()
