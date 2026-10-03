import os
import re
import math
from pathlib import Path
from typing import List, Dict, Any, Optional
from app.models.project import WordTimestamp, SubtitleCue
from app.services.settings_service import settings_service

class AlignmentService:
    def split_story_into_sentences(self, text: str) -> List[str]:
        """
        Split story text into clean sentences/clauses supporting both Hindi (| danda, ।, ?) and English (. ! ?)
        """
        if not text:
            return []
        
        # Replace Hindi purna viram (।) with standard delimiter or split on both
        # Regex splits on ., !, ?, ।, \n\n but keeps non-empty trimmed strings
        raw_parts = re.split(r'(?<=[.!?।\n])\s+', text.strip())
        sentences = [s.strip() for s in raw_parts if s.strip()]
        return sentences if sentences else [text.strip()]

    def estimate_proportional_alignment(self, story_text: str, total_duration: float) -> List[SubtitleCue]:
        """
        Proportional speech alignment fallback based on word counts and punctuation pauses
        """
        sentences = self.split_story_into_sentences(story_text)
        if not sentences:
            return []

        if total_duration <= 0.1:
            total_duration = max(5.0, len(story_text.split()) * 0.4)

        # Calculate weight of each sentence based on word length + pause bonus
        sentence_weights = []
        for s in sentences:
            words = [w for w in s.split() if w]
            weight = len(words) + 1.0 # slight bonus for sentence pause
            sentence_weights.append((s, words, weight))

        total_weight = sum(w[2] for w in sentence_weights) or 1.0
        cues: List[SubtitleCue] = []
        current_time = 0.0

        for sentence_text, words, weight in sentence_weights:
            sentence_duration = (weight / total_weight) * total_duration
            start_time = round(current_time, 2)
            end_time = round(current_time + sentence_duration, 2)

            # Generate estimated word timestamps
            word_cues: List[WordTimestamp] = []
            if words:
                word_dur = sentence_duration / len(words)
                w_curr = start_time
                for w in words:
                    w_end = min(end_time, round(w_curr + word_dur, 2))
                    word_cues.append(WordTimestamp(
                        word=w,
                        start=round(w_curr, 2),
                        end=round(w_end, 2),
                        probability=0.95
                    ))
                    w_curr = w_end

            cues.append(SubtitleCue(
                start_time=start_time,
                end_time=end_time,
                text=sentence_text,
                words=word_cues
            ))
            current_time = end_time

        return cues

    def transcribe_with_openai_whisper(self, audio_path: Path, language_code: Optional[str] = None) -> List[WordTimestamp]:
        """
        Transcribe audio using OpenAI Whisper API with verbose_json word timestamps
        """
        from openai import OpenAI
        settings = settings_service.get_settings()
        api_key = settings.api_keys.openai_api_key

        if not api_key:
            raise ValueError("OpenAI API key not set in Settings")

        client = OpenAI(api_key=api_key)

        with open(audio_path, "rb") as audio_file:
            kwargs: Dict[str, Any] = {
                "model": "whisper-1",
                "file": audio_file,
                "response_format": "verbose_json",
                "timestamp_granularities": ["word"]
            }
            if language_code:
                # 'hi' for Hindi, 'en' for English
                kwargs["language"] = language_code.lower()[:2]

            transcript = client.audio.transcriptions.create(**kwargs)

        word_timestamps: List[WordTimestamp] = []
        # Parse verbose_json words
        if hasattr(transcript, "words") and transcript.words:
            for w in transcript.words:
                word_text = getattr(w, "word", "") or ""
                start = float(getattr(w, "start", 0.0))
                end = float(getattr(w, "end", 0.0))
                word_timestamps.append(WordTimestamp(
                    word=word_text.strip(),
                    start=round(start, 2),
                    end=round(end, 2),
                    probability=0.99
                ))

        return word_timestamps

    def align_whisper_words_to_story(self, story_text: str, whisper_words: List[WordTimestamp], total_duration: float) -> List[SubtitleCue]:
        """
        Align Whisper word timestamps to user's exact story sentences
        """
        sentences = self.split_story_into_sentences(story_text)
        if not sentences:
            return []

        if not whisper_words:
            return self.estimate_proportional_alignment(story_text, total_duration)

        cues: List[SubtitleCue] = []
        current_whisper_idx = 0
        total_whisper_words = len(whisper_words)

        for i, sentence in enumerate(sentences):
            sentence_words = [w for w in sentence.split() if w]
            count = len(sentence_words)

            if count == 0:
                continue

            # Pick corresponding slice from whisper_words
            slice_end = min(total_whisper_words, current_whisper_idx + count)
            # If last sentence, take all remaining
            if i == len(sentences) - 1:
                slice_end = total_whisper_words

            assigned_words = whisper_words[current_whisper_idx:slice_end]

            if assigned_words:
                start_time = assigned_words[0].start
                end_time = assigned_words[-1].end
            else:
                # Fallback to last known end or proportional
                last_end = cues[-1].end_time if cues else 0.0
                start_time = last_end
                end_time = min(total_duration, start_time + max(2.0, count * 0.4))

            # Build SubtitleCue
            cues.append(SubtitleCue(
                start_time=round(start_time, 2),
                end_time=round(max(start_time + 0.5, end_time), 2),
                text=sentence,
                words=assigned_words if assigned_words else [
                    WordTimestamp(word=w, start=round(start_time + idx * 0.3, 2), end=round(start_time + (idx + 1) * 0.3, 2), probability=0.9)
                    for idx, w in enumerate(sentence_words)
                ]
            ))

            current_whisper_idx = slice_end

        return cues

alignment_service = AlignmentService()
