import os
import sys
import io
import time
import base64
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional
import httpx
from PIL import Image
from app.services.image_service import image_service

class PlaywrightChatGPTService:
    def __init__(self):
        self.browser_context = None
        self.page = None
        self.is_running = False
        self.profile_dir = Path.home() / ".storyreel" / "chatgpt_profile"
        self.profile_dir.mkdir(parents=True, exist_ok=True)

    async def open_browser(self) -> Dict[str, Any]:
        """
        Launches a persistent Chrome browser window for ChatGPT with native Chrome or Chromium
        """
        try:
            from playwright.async_api import async_playwright
            if not hasattr(self, 'playwright') or not self.playwright:
                self.playwright = await async_playwright().start()

            launch_args = ["--disable-blink-features=AutomationControlled", "--no-sandbox"]

            # Try candidate launch strategies in priority order
            strategies = []

            # 1. Native Mac Chrome direct executable
            mac_chrome_path = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
            if mac_chrome_path.exists():
                strategies.append({"executable_path": str(mac_chrome_path)})

            # 2. Chrome channel
            strategies.append({"channel": "chrome"})

            # 3. Brave Browser if available
            brave_path = Path("/Applications/Brave Browser.app/Contents/MacOS/Brave Browser")
            if brave_path.exists():
                strategies.append({"executable_path": str(brave_path)})

            # 4. Microsoft Edge if available
            edge_path = Path("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge")
            if edge_path.exists():
                strategies.append({"executable_path": str(edge_path)})

            # 5. Default Playwright Chromium
            strategies.append({})

            last_err = None
            for strat in strategies:
                try:
                    self.browser_context = await self.playwright.chromium.launch_persistent_context(
                        user_data_dir=str(self.profile_dir),
                        headless=False,
                        viewport={"width": 1280, "height": 900},
                        args=launch_args,
                        **strat
                    )
                    if self.browser_context:
                        break
                except Exception as strat_err:
                    last_err = strat_err
                    continue

            if not self.browser_context:
                raise Exception(f"Failed to launch browser with any strategy: {last_err}")

            pages = self.browser_context.pages
            self.page = pages[0] if pages else await self.browser_context.new_page()

            current_url = self.page.url
            if "chatgpt.com" not in current_url and "openai.com" not in current_url:
                await self.page.goto("https://chatgpt.com", wait_until="domcontentloaded")

            self.is_running = True
            return {"status": "open", "message": "ChatGPT browser window is ready! Log in if needed."}
        except Exception as e:
            return {"status": "error", "message": f"Failed to launch browser: {str(e)}"}

    async def generate_and_download_scene(
        self,
        project_id: str,
        scene_id: str,
        prompt: str,
        timeout_seconds: int = 240
    ) -> Optional[Dict[str, Any]]:
        """
        1. Types prompt into ChatGPT prompt area and submits
        2. Waits for prompt submission to register in ChatGPT
        3. Waits while ChatGPT is actively generating/streaming (Stop button, progress indicators, etc.)
        4. Accurately verifies that image generation is 100% complete and high-resolution image is fully loaded
        5. Extracts and validates the high-res image data
        6. Saves and attaches to project scene
        """
        if not self.page or self.page.is_closed():
            res = await self.open_browser()
            if res.get("status") == "error":
                raise Exception(res.get("message"))

        try:
            # Step 1: Find and focus prompt textarea
            prompt_selector = '#prompt-textarea, textarea, div[contenteditable="true"]'
            await self.page.wait_for_selector(prompt_selector, timeout=15000)
            await self.page.click(prompt_selector)
            await asyncio.sleep(0.3)

            # Ensure any lingering text is cleared
            await self.page.fill(prompt_selector, "")
            await asyncio.sleep(0.1)

            # Count initial assistant turns before sending
            initial_turns_count = await self.page.evaluate("""
                () => document.querySelectorAll('div[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"]').length
            """)

            # Step 2: Fill prompt and submit
            await self.page.fill(prompt_selector, prompt)
            await asyncio.sleep(0.4)

            send_btn = await self.page.query_selector('button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label*="Send" i]')
            if send_btn and await send_btn.is_enabled():
                await send_btn.click()
            else:
                await self.page.keyboard.press("Enter")

            # Step 3: Wait for submission to register (up to 12s)
            start_submit_wait = time.time()
            while time.time() - start_submit_wait < 12:
                await asyncio.sleep(0.6)
                sub_status = await self.page.evaluate("""
                    () => {
                        const stopBtn = document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label="Stop generating"], button[aria-label="Stop streaming"]');
                        const isStreaming = !!document.querySelector('.result-streaming');
                        const turns = document.querySelectorAll('div[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"]').length;
                        return {
                            hasStopBtn: !!stopBtn,
                            isStreaming: !!isStreaming,
                            turnsCount: turns
                        };
                    }
                """)
                if sub_status.get("hasStopBtn") or sub_status.get("isStreaming") or sub_status.get("turnsCount", 0) > initial_turns_count:
                    break

            print(f"[Playwright] Scene {scene_id} prompt submitted. Waiting for ChatGPT generation to complete (timeout: {timeout_seconds}s)...")

            # Step 4: Wait for image generation to 100% complete
            # We actively check:
            # a) Is Stop button present? -> ChatGPT is still generating.
            # b) Is streaming container active? -> ChatGPT is still generating.
            # c) Is progress indicator text active? -> ChatGPT is still generating.
            # d) When streaming ends: is the image element complete and naturalWidth > 150? -> 100% finished!
            start_gen_time = time.time()
            last_scroll_time = 0

            while time.time() - start_gen_time < timeout_seconds:
                await asyncio.sleep(2.0)

                # Keep scrolling to bottom so generation progress is always visible
                if time.time() - last_scroll_time > 3.0:
                    last_scroll_time = time.time()
                    await self.page.evaluate("""
                        () => {
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            const m = document.querySelector('main');
                            if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
                        }
                    """)

                gen_status = await self.page.evaluate("""
                    () => {
                        // 1. Check for Stop button or active streaming
                        const stopBtn = document.querySelector('button[data-testid="stop-button"], button[aria-label*="Stop" i], button[aria-label="Stop generating"], button[aria-label="Stop streaming"]');
                        const isStreaming = !!document.querySelector('.result-streaming');
                        
                        // 2. Check for text progress indicators
                        const progressNodes = Array.from(document.querySelectorAll('*')).some(el => {
                            const t = el.textContent || '';
                            return (t.includes('Creating image') || t.includes('Generating image') || t.includes('Creating with DALL·E')) && el.children.length === 0;
                        });

                        // 3. Inspect assistant turns
                        const turns = document.querySelectorAll('div[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"]');
                        if (turns.length === 0) {
                            return { isBusy: true, phase: 'waiting_for_first_turn' };
                        }
                        const lastTurn = turns[turns.length - 1];

                        // Check for ChatGPT error messages
                        const turnText = (lastTurn.innerText || '').toLowerCase();
                        if (turnText.includes("i wasn't able to generate") || 
                            turnText.includes("content policy") || 
                            turnText.includes("something went wrong") ||
                            turnText.includes("i encountered an error") ||
                            turnText.includes("unable to generate")) {
                            return { isBusy: false, isError: true, errorText: lastTurn.innerText.slice(0, 300) };
                        }

                        // If ChatGPT is still generating/streaming, continue waiting
                        if (stopBtn || isStreaming || progressNodes) {
                            return { isBusy: true, phase: 'actively_generating' };
                        }

                        // 4. ChatGPT stopped streaming, check for rendered image
                        const imgs = Array.from(lastTurn.querySelectorAll('img')).filter(img => {
                            const s = img.src || '';
                            return s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:image');
                        });

                        if (imgs.length === 0) {
                            // Turn just ended, image element may be mounting
                            return { isBusy: true, phase: 'awaiting_image_render' };
                        }

                        const targetImg = imgs[imgs.length - 1];
                        // Verify that the image has loaded completely and has full dimensions
                        const isComplete = targetImg.complete && (targetImg.naturalWidth > 150) && (targetImg.naturalHeight > 150);

                        if (!isComplete) {
                            return { isBusy: true, phase: 'loading_image_dimensions' };
                        }

                        return {
                            isBusy: false,
                            isComplete: true,
                            width: targetImg.naturalWidth,
                            height: targetImg.naturalHeight
                        };
                    }
                """)

                if gen_status.get("isError"):
                    err_msg = gen_status.get("errorText", "ChatGPT returned an error during generation.")
                    raise Exception(f"ChatGPT generation error: {err_msg}")

                if not gen_status.get("isBusy") and gen_status.get("isComplete"):
                    elapsed = int(time.time() - start_gen_time)
                    print(f"[Playwright] Scene {scene_id} image generation 100% finished in {elapsed}s! (Resolution: {gen_status.get('width')}x{gen_status.get('height')})")
                    break
            else:
                raise Exception(f"Timed out after {timeout_seconds}s waiting for ChatGPT image generation to complete.")

            # Step 5: Extract high-resolution image bytes
            await asyncio.sleep(1.2) # Small pause for high-res CDN render to settle

            # Primary Extraction: direct fetch from browser context (preserves authenticated CDN session)
            image_base64 = await self.page.evaluate("""
                async () => {
                    const turns = document.querySelectorAll('div[data-message-author-role="assistant"], article[data-testid^="conversation-turn-"]');
                    if (turns.length === 0) return null;
                    const lastTurn = turns[turns.length - 1];
                    const imgs = Array.from(lastTurn.querySelectorAll('img')).filter(img => {
                        const s = img.src || '';
                        return s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:image');
                    });
                    if (imgs.length === 0) return null;
                    const targetImg = imgs[imgs.length - 1];

                    try {
                        const response = await fetch(targetImg.src);
                        const blob = await response.blob();
                        return new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result.split(',')[1]);
                            reader.readAsDataURL(blob);
                        });
                    } catch (e) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = targetImg.naturalWidth || 1024;
                            canvas.height = targetImg.naturalHeight || 1024;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(targetImg, 0, 0);
                            return canvas.toDataURL('image/png').split(',')[1];
                        } catch (e2) {
                            return null;
                        }
                    }
                }
            """)

            downloaded_bytes = None
            if image_base64:
                try:
                    downloaded_bytes = base64.b64decode(image_base64)
                except Exception as b64_err:
                    print(f"[Playwright] Base64 decode note: {b64_err}")

            # Fallback Extraction: Click modal and download button if base64 direct fetch failed
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    last_turn_img = await self.page.query_selector('div[data-message-author-role="assistant"]:last-of-type img, article[data-testid^="conversation-turn-"]:last-of-type img')
                    if last_turn_img:
                        await last_turn_img.click()
                        await asyncio.sleep(1.2)
                        download_btn = await self.page.query_selector('button:has-text("Download"), button[aria-label*="Download" i]')
                        if download_btn:
                            async with self.page.expect_download(timeout=15000) as download_info:
                                await download_btn.click()
                            download = await download_info.value
                            temp_path = self.profile_dir / f"temp_{scene_id}.png"
                            await download.save_as(str(temp_path))
                            with open(temp_path, "rb") as f:
                                downloaded_bytes = f.read()
                            if temp_path.exists():
                                temp_path.unlink()
                        await self.page.keyboard.press("Escape")
                except Exception as dl_err:
                    print(f"[Playwright] Modal download fallback note: {dl_err}")

            # Validate image integrity with PIL
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                raise Exception("Failed to retrieve valid image bytes from ChatGPT.")

            try:
                pil_img = Image.open(io.BytesIO(downloaded_bytes))
                if pil_img.width < 100 or pil_img.height < 100:
                    raise Exception(f"Extracted image is too small ({pil_img.width}x{pil_img.height})")
            except Exception as pil_err:
                raise Exception(f"Extracted image file corrupted: {pil_err}")

            # Step 6: Ensure modal is closed and UI is clean for next prompt
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.5)

            # Step 7: Save and assign to project scene
            scene = image_service.assign_image_to_scene(
                project_id,
                scene_id,
                downloaded_bytes,
                f"chatgpt_scene_{scene_id}.png"
            )
            return scene.model_dump()

        except Exception as e:
            print(f"[Playwright] Generation error for scene {scene_id}: {e}")
            raise e

playwright_chatgpt_service = PlaywrightChatGPTService()
