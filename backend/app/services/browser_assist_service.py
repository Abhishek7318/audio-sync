import os
import sys
import time
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional
from PIL import Image
from app.services.image_service import image_service

class BrowserAssistService:
    def copy_to_clipboard(self, text: str):
        """
        Copies text to OS clipboard
        """
        if sys.platform == "darwin":
            process = subprocess.Popen("pbcopy", env={"LANG": "en_US.UTF-8"}, stdin=subprocess.PIPE)
            process.communicate(text.encode("utf-8"))
        elif sys.platform == "win32":
            import ctypes
            # Windows clip command
            process = subprocess.Popen("clip", stdin=subprocess.PIPE, shell=True)
            process.communicate(text.encode("utf-8"))
        else:
            try:
                process = subprocess.Popen(["xclip", "-selection", "clipboard"], stdin=subprocess.PIPE)
                process.communicate(text.encode("utf-8"))
            except Exception:
                pass

    def focus_browser_and_paste(
        self,
        prompt: str,
        browser_name: str = "Google Chrome",
        press_enter: bool = True
    ) -> bool:
        """
        Focuses the user's browser, pastes the prompt into the active chat tab, and presses Enter/Return.
        Attempts direct JavaScript injection in Chrome if supported, then falls back to OS Keystroke automation.
        """
        self.copy_to_clipboard(prompt)

        if sys.platform == "darwin":
            # Strategy 1: Try JavaScript injection in Chrome active tab
            escaped_prompt = prompt.replace('"', '\\"').replace('\n', ' ')
            js_script = f'''
            tell application "{browser_name}"
                activate
                tell active tab of front window
                    execute javascript "
                        (function() {{
                            const el = document.querySelector('#prompt-textarea') || document.querySelector('div[contenteditable=\\"true\\"]') || document.querySelector('textarea');
                            if (el) {{
                                el.focus();
                                el.value = '';
                                document.execCommand('insertText', false, \\"{escaped_prompt}\\");
                                setTimeout(() => {{
                                    const btn = document.querySelector('button[data-testid=\\"send-button\\"]') || document.querySelector('button[aria-label=\\"Send prompt\\"]');
                                    if (btn) btn.click();
                                }}, 400);
                                return 'success';
                            }}
                            return 'no_input_found';
                        }})();
                    "
                end tell
            end tell
            '''
            try:
                result = subprocess.run(["osascript", "-e", js_script], capture_output=True, text=True, check=True)
                if "success" in result.stdout:
                    return True
            except Exception:
                # JavaScript via Apple Events might not be turned on, fallback to System Events
                pass

            # Strategy 2: System Events UI Keystroke Automation
            enter_script = """
                delay 0.5
                keystroke return
            """ if press_enter else ""

            apple_script = f'''
            tell application "{browser_name}"
                activate
            end tell
            delay 0.6
            tell application "System Events"
                tell process "{browser_name}"
                    -- Press Tab / / to focus text input field
                    keystroke "/"
                    delay 0.2
                    keystroke "v" using command down
                    {enter_script}
                end tell
            end tell
            '''
            try:
                subprocess.run(["osascript", "-e", apple_script], check=True)
                return True
            except Exception as e:
                print(f"Failed to automate browser with AppleScript: {e}")
                try:
                    subprocess.run(["open", "-a", browser_name])
                except Exception:
                    pass
                return False

        elif sys.platform == "win32":
            # On Windows, use PyAutoGUI or PowerShell
            try:
                import pyautogui
                pyautogui.hotkey('ctrl', 'v')
                if press_enter:
                    time.sleep(0.4)
                    pyautogui.press('enter')
                return True
            except Exception as e:
                print(f"Windows automation notice: {e}")
                return False
        return False

    def auto_detect_and_attach_download(
        self,
        project_id: str,
        scene_id: str,
        start_time_threshold: float,
        downloads_dir: Optional[Path] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Scans downloads directory for complete images downloaded since start_time_threshold
        """
        d_dir = downloads_dir or (Path.home() / "Downloads")
        if not d_dir.exists():
            return None

        recent_images = []
        for f in d_dir.iterdir():
            if f.is_file() and f.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
                if f.name.startswith("."):
                    continue
                try:
                    mtime = f.stat().st_mtime
                    if mtime >= start_time_threshold - 5.0: # within session window
                        # Verify file is complete and not partially downloaded
                        try:
                            with Image.open(f) as img:
                                img.verify()
                            recent_images.append((mtime, f))
                        except Exception:
                            # File might still be downloading / incomplete
                            continue
                except Exception:
                    continue

        if not recent_images:
            return None

        recent_images.sort(key=lambda x: x[0], reverse=True)
        latest_file = recent_images[0][1]

        # Attach to scene
        scene = image_service.assign_image_to_scene(project_id, scene_id, latest_file, latest_file.name)
        return scene.model_dump()

browser_assist_service = BrowserAssistService()
