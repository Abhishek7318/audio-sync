import unittest
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.services.alignment_service import alignment_service
from app.models.project import WordTimestamp

class TestAlignmentEngine(unittest.TestCase):
    def test_hindi_sentence_splitting(self):
        hindi_text = "एक घने जंगल के बीच विक्रम खड़ा था। उसने अपने हाथ में पकड़े पुराने नक्शे को देखा! क्या वह मंदिर तक पहुँच पाएगा?"
        sentences = alignment_service.split_story_into_sentences(hindi_text)
        self.assertEqual(len(sentences), 3)
        self.assertIn("विक्रम खड़ा था।", sentences[0])
        self.assertIn("नक्शे को देखा!", sentences[1])
        self.assertIn("पहुँच पाएगा?", sentences[2])

    def test_english_sentence_splitting(self):
        english_text = "Deep inside the dense mountain forest, shadows danced. Vikram gripped the parchment tightly. The journey had begun."
        sentences = alignment_service.split_story_into_sentences(english_text)
        self.assertEqual(len(sentences), 3)

    def test_proportional_alignment_duration(self):
        text = "First sentence of the story. Second sentence with more words in it. Third sentence."
        total_duration = 15.0
        cues = alignment_service.estimate_proportional_alignment(text, total_duration)
        self.assertEqual(len(cues), 3)
        self.assertEqual(cues[0].start_time, 0.0)
        self.assertAlmostEqual(cues[-1].end_time, total_duration, delta=0.5)

        # Check word timestamps are populated
        for cue in cues:
            self.assertTrue(len(cue.words) > 0)
            self.assertLess(cue.start_time, cue.end_time)

    def test_whisper_word_alignment_to_story(self):
        story_text = "Hello world. This is a story."
        whisper_words = [
            WordTimestamp(word="Hello", start=0.2, end=0.6, probability=0.99),
            WordTimestamp(word="world", start=0.7, end=1.1, probability=0.99),
            WordTimestamp(word="This", start=1.5, end=1.8, probability=0.99),
            WordTimestamp(word="is", start=1.9, end=2.1, probability=0.99),
            WordTimestamp(word="a", start=2.2, end=2.3, probability=0.99),
            WordTimestamp(word="story", start=2.4, end=2.9, probability=0.99),
        ]
        cues = alignment_service.align_whisper_words_to_story(story_text, whisper_words, 3.5)
        self.assertEqual(len(cues), 2)
        self.assertEqual(cues[0].text, "Hello world.")
        self.assertEqual(cues[0].start_time, 0.2)
        self.assertEqual(cues[0].end_time, 1.1)
        self.assertEqual(cues[1].text, "This is a story.")
        self.assertEqual(cues[1].start_time, 1.5)
        self.assertEqual(cues[1].end_time, 2.9)

if __name__ == "__main__":
    unittest.main()
