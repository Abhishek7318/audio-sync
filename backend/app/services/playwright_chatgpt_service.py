import os
import sys
import time
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
        Launches a persistent Chrome browser window for ChatGPT with native Chrome
        """
        try:
            from playwright.async_api import async_playwright
            self.playwright = await async_playwright().start()

            # Launch persistent context using native Chrome channel
            self.browser_context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.profile_dir),
                channel="chrome",
                headless=False,
                viewport={"width": 1280, "height": 900},
                args=["--disable-blink-features=AutomationControlled"]
            )

            pages = self.browser_context.pages
            self.page = pages[0] if pages else await self.browser_context.new_page()

            current_url = self.page.url
            if "chatgpt.com" not in current_url and "openai.com" not in current_url:
                await self.page.goto("https://chatgpt.com", wait_until="domcontentloaded")

            self.is_running = True
            return {"status": "open", "message": "ChatGPT browser window is ready! Log in if needed."}
        except Exception as e:
            # Fallback to default chromium if chrome channel fails
            try:
                from playwright.async_api import async_playwright
                if not hasattr(self, 'playwright') or not self.playwright:
                    self.playwright = await async_playwright().start()
                self.browser_context = await self.playwright.chromium.launch_persistent_context(
                    user_data_dir=str(self.profile_dir),
                    headless=False,
                    viewport={"width": 1280, "height": 900},
                    args=["--disable-blink-features=AutomationControlled"]
                )
                pages = self.browser_context.pages
                self.page = pages[0] if pages else await self.browser_context.new_page()
                await self.page.goto("https://chatgpt.com", wait_until="domcontentloaded")
                self.is_running = True
                return {"status": "open", "message": "ChatGPT browser window ready!"}
            except Exception as e2:
                return {"status": "error", "message": f"Failed to launch browser: {str(e2)}"}

    async def generate_and_download_scene(
        self,
        project_id: str,
        scene_id: str,
        prompt: str,
        timeout_seconds: int = 120
    ) -> Optional[Dict[str, Any]]:
        """
        1. Types prompt into ChatGPT prompt area
        2. Submits prompt
        3. Smoothly scrolls down so the image generation is visible
        4. Waits for AI image generation to complete (~15-25s)
        5. Clicks the Share icon / image to open download modal
        6. Clicks the Download button to download image
        7. Saves and attaches to project scene
        """
        if not self.page or self.page.is_closed():
            res = await self.open_browser()
            if res.get("status") == "error":
                raise Exception(res.get("message"))

        try:
            # Step 1: Find and focus prompt textarea
            prompt_selector = '#prompt-textarea, textarea, div[contenteditable="true"]'
            await self.page.wait_for_selector(prompt_selector, timeout=12000)
            await self.page.click(prompt_selector)
            await asyncio.sleep(0.3)

            # Step 2: Fill prompt and submit
            await self.page.fill(prompt_selector, prompt)
            await asyncio.sleep(0.4)

            send_btn = await self.page.query_selector('button[data-testid="send-button"], button[aria-label="Send prompt"]')
            if send_btn and await send_btn.is_enabled():
                await send_btn.click()
            else:
                await self.page.keyboard.press("Enter")

            # Step 3: Smooth scroll to bottom so the user sees generation live
            await asyncio.sleep(1.0)
            await self.page.evaluate("""
                () => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    const m = document.querySelector('main');
                    if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
                }
            """)

            # Count existing images in chat
            existing_imgs = await self.page.query_selector_all('div[data-message-author-role="assistant"] img, img[alt*="Generated"]')
            prev_count = len(existing_imgs)

            # Step 4: Wait for image generation to finish
            start_wait = time.time()
            new_img = None

            while time.time() - start_wait < timeout_seconds:
                await asyncio.sleep(2.0)
                # Keep scrolled to bottom
                await self.page.evaluate("""
                    () => {
                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        const m = document.querySelector('main');
                        if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
                    }
                """)

                current_imgs = await self.page.query_selector_all('div[data-message-author-role="assistant"] img, img[alt*="Generated"]')
                if len(current_imgs) > prev_count:
                    candidate = current_imgs[-1]
                    src = await candidate.get_attribute("src")
                    if src and not src.startswith("data:image/svg") and not src.startswith("data:,"):
                        new_img = candidate
                        break

            if not new_img:
                raise Exception("Timed out waiting for ChatGPT image generation.")

            # Scroll newly generated image into view
            await new_img.scroll_into_view_if_needed()
            await asyncio.sleep(1.0)

            # Step 5 & 6: Download the image
            # Try Option A: Click Share Icon / Image -> Click Download in Modal
            downloaded_bytes = None

            try:
                # Find share button on image or click the image directly
                # In screenshot 1: share button is on bottom right of image container
                share_btn = await self.page.query_selector('button[aria-label="Share"], button[aria-label="Share image"], button[aria-label*="share" i]')
                if not share_btn:
                    # Click on the image itself to open modal
                    await new_img.click()
                else:
                    await share_btn.click()

                await asyncio.sleep(1.2)

                # In modal (screenshot 2): Look for the Download button
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

                    # Close modal
                    await self.page.keyboard.press("Escape")
            except Exception as download_err:
                print(f"Modal download notice: {download_err}, falling back to direct image extraction...")

            # Fallback Option B: Fetch image directly via URL / Blob
            if not downloaded_bytes:
                img_src = await new_img.get_attribute("src")
                if img_src and img_src.startswith("http"):
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        resp = await client.get(img_src)
                        if resp.status_code == 200:
                            downloaded_bytes = resp.content
                elif img_src:
                    image_base64 = await self.page.evaluate("""
                        async (img) => {
                            const response = await fetch(img.src);
                            const blob = await response.blob();
                            return new Promise((resolve) => {
                                const reader = new FileReader();
                                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                                reader.readAsDataURL(blob);
                            });
                        }
                    """, new_img)
                    import base64
                    downloaded_bytes = base64.b64decode(image_base64)

            if not downloaded_bytes:
                raise Exception("Failed to retrieve generated image bytes.")

            # Step 7: Save and assign to project scene
            scene = image_service.assign_image_to_scene(
                project_id,
                scene_id,
                downloaded_bytes,
                f"chatgpt_scene_{scene_id}.png"
            )
            return scene.model_dump()

        except Exception as e:
            print(f"Playwright generation error: {e}")
            raise e

playwright_chatgpt_service = PlaywrightChatGPTService()
