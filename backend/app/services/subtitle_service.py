import uuid
from pathlib import Path
from typing import List, Optional, Dict, Any
from app.models.project import SubtitleCue, SubtitleStyle, WordTimestamp, Project
from app.services.project_service import project_service

class SubtitleService:
    def format_srt_time(self, seconds: float) -> str:
        """Format seconds to SRT timecode HH:MM:SS,mmm"""
        seconds = max(0.0, seconds)
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        ms = int(round((seconds % 1) * 1000))
        return f"{hrs:02d}:{mins:02d}:{secs:02d},{ms:03d}"

    def format_ass_time(self, seconds: float) -> str:
        """Format seconds to ASS timecode H:MM:SS.cc (centiseconds)"""
        seconds = max(0.0, seconds)
        hrs = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        cs = int(round((seconds % 1) * 100))
        return f"{hrs:d}:{mins:02d}:{secs:02d}.{cs:02d}"

    def hex_to_ass_color(self, hex_str: str, alpha_hex: str = "00") -> str:
        """
        Convert hex color #RRGGBB or #RGB to ASS format &HAABBGGRR (Blue-Green-Red order)
        """
        if not hex_str:
            return "&H00FFFFFF"
        
        hex_clean = hex_str.lstrip('#')
        if len(hex_clean) == 3:
            r = hex_clean[0] * 2
            g = hex_clean[1] * 2
            b = hex_clean[2] * 2
        elif len(hex_clean) == 6:
            r = hex_clean[0:2]
            g = hex_clean[2:4]
            b = hex_clean[4:6]
        else:
            return "&H00FFFFFF"

        # In ASS, color format is &HAABBGGRR
        return f"&H{alpha_hex.upper()}{b.upper()}{g.upper()}{r.upper()}"

    def generate_srt(self, subtitles: List[SubtitleCue]) -> str:
        """Generate standard SubRip (.srt) subtitle content"""
        lines = []
        for i, cue in enumerate(subtitles, start=1):
            start_str = self.format_srt_time(cue.start_time)
            end_str = self.format_srt_time(cue.end_time)
            lines.append(str(i))
            lines.append(f"{start_str} --> {end_str}")
            lines.append(cue.text.strip())
            lines.append("")
        return "\n".join(lines)

    def generate_ass(
        self,
        subtitles: List[SubtitleCue],
        style: SubtitleStyle,
        aspect_ratio: str = "16:9",
        res_x: int = 1920,
        res_y: int = 1080
    ) -> str:
        """
        Generate Advanced SubStation Alpha (.ass) subtitle file with typography,
        positioning, outline, shadow, and word-by-word karaoke timing.
        """
        # Determine ASS alignment code:
        # 2 = Bottom-Center, 5 = Middle-Center, 8 = Top-Center
        alignment = 2
        if style.position == "top":
            alignment = 8
        elif style.position == "center":
            alignment = 5

        # Colors in ASS &HAABBGGRR
        pri_color = self.hex_to_ass_color(style.primary_color)
        sec_color = self.hex_to_ass_color(style.secondary_color) # Karaoke active color
        out_color = self.hex_to_ass_color(style.outline_color)
        back_color = self.hex_to_ass_color("#000000", "80")

        # ASS Header
        lines = [
            "[Script Info]",
            "Title: StoryReel Studio Subtitles",
            "ScriptType: v4.00+",
            "WrapStyle: 0",
            "ScaledBorderAndShadow: yes",
            f"PlayResX: {res_x}",
            f"PlayResY: {res_y}",
            "",
            "[V4+ Styles]",
            "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
            f"Style: Default,{style.font_family},{style.font_size},{pri_color},{sec_color},{out_color},{back_color},1,0,0,0,100,100,0,0,{3 if style.background_enabled else 1},{style.outline_width},{style.shadow_offset},{alignment},{style.margin_h},{style.margin_h},{style.margin_v},1",
            "",
            "[Events]",
            "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
        ]

        # Generate Dialogue Events
        for cue in subtitles:
            start_str = self.format_ass_time(cue.start_time)
            end_str = self.format_ass_time(cue.end_time)

            text_content = cue.text
            if style.uppercase:
                text_content = text_content.upper()

            # Karaoke word highlight formatting if words exist and mode is word_karaoke
            if style.mode == "word_karaoke" and cue.words and len(cue.words) > 0:
                karaoke_parts = []
                for w in cue.words:
                    word_duration_cs = max(1, int(round((w.end - w.start) * 100)))
                    word_text = w.word.upper() if style.uppercase else w.word
                    karaoke_parts.append(f"{{\\k{word_duration_cs}}}{word_text} ")
                dialogue_text = "".join(karaoke_parts).strip()
            elif style.animation == "pop":
                dialogue_text = f"{{\\t(0,100,\\fscx115\\fscy115)\\t(100,200,\\fscx100\\fscy100)}}{text_content}"
            elif style.animation == "fade":
                dialogue_text = f"{{\\fad(150,150)}}{text_content}"
            else:
                dialogue_text = text_content

            lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{dialogue_text}")

        return "\n".join(lines)

    def save_subtitle_files(self, project: Project) -> Dict[str, str]:
        """Generate and save both .srt and .ass files to the project's subtitles directory"""
        pdir = project_service.get_project_dir(project.id)
        if not pdir:
            return {}

        sub_dir = pdir / "subtitles"
        sub_dir.mkdir(parents=True, exist_ok=True)

        srt_content = self.generate_srt(project.subtitles)
        srt_file = sub_dir / "subtitles.srt"
        with open(srt_file, "w", encoding="utf-8") as f:
            f.write(srt_content)

        ass_content = self.generate_ass(
            subtitles=project.subtitles,
            style=project.subtitle_style,
            aspect_ratio=project.aspect_ratio
        )
        ass_file = sub_dir / "subtitles.ass"
        with open(ass_file, "w", encoding="utf-8") as f:
            f.write(ass_content)

        return {
            "srt_path": str(srt_file),
            "ass_path": str(ass_file)
        }

    def update_style(self, project_id: str, style_data: Dict[str, Any]) -> Project:
        """Update subtitle style and regenerate ASS/SRT files"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        current_style_dict = project.subtitle_style.model_dump()
        current_style_dict.update(style_data)
        project.subtitle_style = SubtitleStyle(**current_style_dict)

        # Save files
        self.save_subtitle_files(project)
        project_service.save_project(project)
        return project

    def update_cues(self, project_id: str, cues_data: List[Dict[str, Any]]) -> Project:
        """Update subtitle cues array"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        updated_cues = []
        for c in cues_data:
            words = [WordTimestamp(**w) for w in c.get("words", [])]
            cue = SubtitleCue(
                id=c.get("id", str(uuid.uuid4())),
                start_time=float(c["start_time"]),
                end_time=float(c["end_time"]),
                text=str(c["text"]),
                words=words,
                speaker=c.get("speaker")
            )
            updated_cues.append(cue)

        project.subtitles = updated_cues
        self.save_subtitle_files(project)
        project_service.save_project(project)
        return project

    def update_single_cue(self, project_id: str, cue_id: str, cue_data: Dict[str, Any]) -> Project:
        """Update text or timestamps of a single cue"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        for cue in project.subtitles:
            if cue.id == cue_id:
                if "text" in cue_data:
                    cue.text = cue_data["text"]
                if "start_time" in cue_data:
                    cue.start_time = float(cue_data["start_time"])
                if "end_time" in cue_data:
                    cue.end_time = float(cue_data["end_time"])
                break

        self.save_subtitle_files(project)
        project_service.save_project(project)
        return project

    def split_cue(
        self,
        project_id: str,
        cue_id: str,
        split_time: float,
        text_part1: str,
        text_part2: str
    ) -> Project:
        """Split a subtitle cue into two separate cues at split_time"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        new_cues = []
        for cue in project.subtitles:
            if cue.id == cue_id:
                clamped_split = max(cue.start_time + 0.1, min(cue.end_time - 0.1, split_time))
                
                # Split words
                words1 = [w for w in cue.words if w.end <= clamped_split]
                words2 = [w for w in cue.words if w.start >= clamped_split]

                cue1 = SubtitleCue(
                    start_time=cue.start_time,
                    end_time=clamped_split,
                    text=text_part1,
                    words=words1,
                    speaker=cue.speaker
                )
                cue2 = SubtitleCue(
                    start_time=clamped_split,
                    end_time=cue.end_time,
                    text=text_part2,
                    words=words2,
                    speaker=cue.speaker
                )
                new_cues.extend([cue1, cue2])
            else:
                new_cues.append(cue)

        project.subtitles = new_cues
        self.save_subtitle_files(project)
        project_service.save_project(project)
        return project

    def merge_cues(self, project_id: str, cue_id1: str, cue_id2: str) -> Project:
        """Merge two adjacent cues into one"""
        project = project_service.get_project(project_id)
        if not project:
            raise ValueError("Project not found")

        idx1 = next((i for i, c in enumerate(project.subtitles) if c.id == cue_id1), -1)
        idx2 = next((i for i, c in enumerate(project.subtitles) if c.id == cue_id2), -1)

        if idx1 == -1 or idx2 == -1:
            raise ValueError("One or both cues not found")

        c1 = project.subtitles[idx1]
        c2 = project.subtitles[idx2]

        merged_words = c1.words + c2.words
        merged_cue = SubtitleCue(
            id=c1.id,
            start_time=min(c1.start_time, c2.start_time),
            end_time=max(c1.end_time, c2.end_time),
            text=f"{c1.text.strip()} {c2.text.strip()}".strip(),
            words=merged_words,
            speaker=c1.speaker or c2.speaker
        )

        new_cues = []
        for i, c in enumerate(project.subtitles):
            if i == min(idx1, idx2):
                new_cues.append(merged_cue)
            elif i == max(idx1, idx2):
                continue
            else:
                new_cues.append(c)

        project.subtitles = new_cues
        self.save_subtitle_files(project)
        project_service.save_project(project)
        return project

subtitle_service = SubtitleService()
