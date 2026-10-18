import os
import sys
import io
import time
import base64
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List, Set
import httpx
from PIL import Image
from app.services.image_service import image_service

class PlaywrightChatGPTService:
    def __init__(self):
        self.playwright = None
        self.browser_context = None
        self.page = None
        self.is_running = False
        self.profile_dir = Path.home() / ".storyreel" / "chatgpt_profile"
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.seen_image_urls: Set[str] = set()

    async def open_browser(self) -> Dict[str, Any]:
        """
        Launches a persistent Chrome browser window for ChatGPT with native Chrome
        """
        try:
            if self.browser_context and self.page and not self.page.is_closed():
                await self.page.bring_to_front()
                return {"status": "open", "message": "ChatGPT browser window is already active."}

            from playwright.async_api import async_playwright
            if not self.playwright:
                self.playwright = await async_playwright().start()

            # Launch persistent context using native Chrome channel with background execution flags
            self.browser_context = await self.playwright.chromium.launch_persistent_context(
                user_data_dir=str(self.profile_dir),
                channel="chrome",
                headless=False,
                viewport={"width": 1280, "height": 900},
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-background-timer-throttling",
                    "--disable-backgrounding-occluded-windows",
                    "--disable-renderer-backgrounding",
                ]
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
                if not self.playwright:
                    self.playwright = await async_playwright().start()
                self.browser_context = await self.playwright.chromium.launch_persistent_context(
                    user_data_dir=str(self.profile_dir),
                    headless=False,
                    viewport={"width": 1280, "height": 900},
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--disable-background-timer-throttling",
                        "--disable-backgrounding-occluded-windows",
                        "--disable-renderer-backgrounding",
                    ]
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
        timeout_seconds: int = 240
    ) -> Optional[Dict[str, Any]]:
        """
        1. Captures all pre-existing images on page into tracking set
        2. Types prompt into ChatGPT prompt area and confirms submission
        3. Strictly monitors generation state (ensures DALL-E produces a BRAND-NEW image)
        4. Accurately verifies that image generation is 100% complete
        5. Extracts high-resolution image using fail-safe strategies (Direct CDN, Canvas Export, Base64, Screenshot)
        6. Validates image integrity and assigns directly to project scene
        """
        if not self.page or self.page.is_closed():
            res = await self.open_browser()
            if res.get("status") == "error":
                raise Exception(res.get("message"))

        try:
            # Do not force window to front - allow headless-like background execution while user works in other windows
            # Ensure we are on ChatGPT
            current_url = self.page.url
            if "chatgpt.com" not in current_url and "openai.com" not in current_url:
                await self.page.goto("https://chatgpt.com", wait_until="domcontentloaded")
                await asyncio.sleep(2.0)

            # Step 1: Capture existing images on page prior to sending prompt
            pre_info = await self.page.evaluate("""
                () => {
                    const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                        const s = img.src || img.currentSrc || '';
                        if (!s) return false;
                        if (s.includes('avatar') || s.includes('profile') || s.includes('svg') || s.includes('gravatar') || s.includes('favicon')) return false;
                        return s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:image');
                    });
                    const turns = document.querySelectorAll('article[data-testid^="conversation-turn-"], div[data-message-author-role="assistant"], div[data-message-author-role="user"]');
                    return {
                        count: imgs.length,
                        srcs: imgs.map(i => i.src || i.currentSrc).filter(Boolean),
                        turnCount: turns.length
                    };
                }
            """)
            
            # Accumulate all seen image URLs so previous scenes' images are NEVER mistaken as new
            current_srcs = pre_info.get("srcs", [])
            for s in current_srcs:
                self.seen_image_urls.add(s)

            prior_srcs_list = list(self.seen_image_urls)
            prior_turn_count = pre_info.get("turnCount", 0)
            print(f"[Playwright] Scene {scene_id}: Prior image count = {len(prior_srcs_list)}, Prior turns = {prior_turn_count}")

            # Close any open lightboxes or popups
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.3)

            # Scroll to bottom so input is in view
            await self.page.evaluate("""
                () => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
                    const m = document.querySelector('main');
                    if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'instant' });
                }
            """)
            await asyncio.sleep(0.3)

            # Step 2: Focus and inject prompt (supports textarea and ProseMirror)
            prompt_injected = await self.page.evaluate("""
                (text) => {
                    const el = document.querySelector('#prompt-textarea, div[role="textbox"][contenteditable="true"], div.ProseMirror, textarea');
                    if (!el) return false;
                    el.focus();
                    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                        el.value = text;
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                        // ProseMirror contenteditable container (Trusted Types compliant)
                        const p = document.createElement('p');
                        p.textContent = text;
                        if (typeof el.replaceChildren === 'function') {
                            el.replaceChildren(p);
                        } else {
                            while (el.firstChild) el.removeChild(el.firstChild);
                            el.appendChild(p);
                        }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    return true;
                }
            """, prompt)

            if not prompt_injected:
                prompt_locator = self.page.locator('#prompt-textarea, div[role="textbox"][contenteditable="true"], div.ProseMirror, textarea').first
                await prompt_locator.wait_for(timeout=15000)
                await prompt_locator.click()
                await self.page.keyboard.press("Meta+A")
                await self.page.keyboard.press("Backspace")
                await self.page.keyboard.insert_text(prompt)

            await asyncio.sleep(0.5)

            # Step 3: Submit prompt
            submitted = await self.page.evaluate("""
                () => {
                    const sendBtn = document.querySelector('button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send" i]');
                    if (sendBtn && !sendBtn.disabled) {
                        sendBtn.click();
                        return true;
                    }
                    return false;
                }
            """)

            if not submitted:
                send_btn = await self.page.query_selector('button[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="Send message"], button[aria-label*="Send" i]')
                if send_btn and await send_btn.is_enabled():
                    await send_btn.click()
                else:
                    await self.page.keyboard.press("Enter")

            print(f"[Playwright] Scene {scene_id} prompt submitted. Waiting for ChatGPT to begin processing...")
            await asyncio.sleep(2.0)

            # Verify if input still contains full text (if so, press Enter again)
            is_still_in_input = await self.page.evaluate("""
                () => {
                    const el = document.querySelector('#prompt-textarea, div[role="textbox"][contenteditable="true"], div.ProseMirror, textarea');
                    if (!el) return false;
                    const text = el.innerText || el.value || '';
                    return text.trim().length > 10;
                }
            """)
            if is_still_in_input:
                print(f"[Playwright] Scene {scene_id}: Retrying submit via Enter key...")
                prompt_loc = self.page.locator('#prompt-textarea, div[role="textbox"][contenteditable="true"], div.ProseMirror, textarea').first
                if await prompt_loc.count() > 0:
                    await prompt_loc.click()
                    await self.page.keyboard.press("Enter")
                await asyncio.sleep(2.0)

            # Step 4: Actively monitor generation until BRAND NEW image is 100% complete
            print(f"[Playwright] Scene {scene_id}: Monitoring ChatGPT generation (timeout: {timeout_seconds}s)...")
            start_gen_time = time.time()
            target_image_src = None
            last_scroll_time = 0
            MIN_GEN_SECONDS = 5  # DALL-E never finishes in under 5 seconds

            while time.time() - start_gen_time < timeout_seconds:
                await asyncio.sleep(1.8)
                elapsed = time.time() - start_gen_time

                # Keep scrolling to bottom so newly rendered items load into DOM
                if time.time() - last_scroll_time > 2.5:
                    last_scroll_time = time.time()
                    await self.page.evaluate("""
                        () => {
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            const m = document.querySelector('main');
                            if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
                        }
                    """)

                gen_status = await self.page.evaluate("""
                    ({ priorSrcs, minGenPassed }) => {
                        const priorSet = new Set(priorSrcs);

                        // 1. Check for assistant error messages in the last turn
                        const turns = Array.from(document.querySelectorAll('article[data-testid^="conversation-turn-"], div[data-message-author-role="assistant"]'));
                        if (turns.length > 0) {
                            const lastTurn = turns[turns.length - 1];
                            const turnText = (lastTurn.innerText || '').toLowerCase();
                            if (turnText.includes("i wasn't able to generate") || 
                                turnText.includes("content policy") || 
                                turnText.includes("violates our usage") ||
                                turnText.includes("something went wrong") ||
                                turnText.includes("i encountered an error") ||
                                turnText.includes("unable to generate") ||
                                turnText.includes("error generating image") ||
                                turnText.includes("too many requests") ||
                                turnText.includes("rate limit")) {
                                return { isError: true, errorText: lastTurn.innerText.slice(0, 300) };
                            }
                        }

                        // 2. Check for active stop generating / streaming / loading indicators
                        const allStopBtns = Array.from(document.querySelectorAll('button[data-testid="stop-button"], button[aria-label*="Stop generating" i], button[aria-label*="Stop streaming" i], button[aria-label*="Stop" i]'));
                        const isStopActive = allStopBtns.some(b => {
                            const rect = b.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0 && window.getComputedStyle(b).display !== 'none';
                        });

                        const isStreaming = !!document.querySelector('.result-streaming, [class*="streaming"]');
                        
                        const isPlaceholderActive = !!document.querySelector(
                            'div[data-testid="image-generating"], div.animate-pulse, div[aria-label*="Generating" i], div[aria-label*="Creating" i]'
                        );

                        let isTurnGenerating = false;
                        if (turns.length > 0) {
                            const lastTurn = turns[turns.length - 1];
                            const tText = (lastTurn.innerText || '').toLowerCase();
                            if (tText.includes("creating image") || tText.includes("generating image") || tText.includes("thinking...")) {
                                isTurnGenerating = true;
                            }
                        }

                        // 3. Inspect all images currently on the page
                        const allImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                            const s = img.src || img.currentSrc || '';
                            if (!s) return false;
                            if (s.includes('avatar') || s.includes('profile') || s.includes('svg') || s.includes('gravatar') || s.includes('favicon')) return false;
                            return s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:image');
                        });

                        // STRICT FILTER: Image MUST NOT be in priorSrcs list!
                        const newImgs = allImgs.filter(img => {
                            const s = img.src || '';
                            const cs = img.currentSrc || '';
                            const inS = s ? priorSet.has(s) : false;
                            const inCs = cs ? priorSet.has(cs) : false;
                            return !inS && !inCs;
                        });

                        // If NO new image exists yet:
                        if (newImgs.length === 0) {
                            return {
                                isBusy: true,
                                phase: 'waiting_for_new_image',
                                isStopActive,
                                isStreaming,
                                isPlaceholderActive,
                                isTurnGenerating,
                                newImgsCount: 0
                            };
                        }

                        // Candidate is the latest newly generated image
                        const candidateImg = newImgs[newImgs.length - 1];
                        const isLoaded = candidateImg.complete && candidateImg.naturalWidth >= 200 && candidateImg.naturalHeight >= 200;

                        // If minimum generation time has not elapsed yet, keep waiting
                        if (!minGenPassed) {
                            return { isBusy: true, phase: 'initial_grace_period', src: candidateImg.src };
                        }

                        // If generation indicators are still active, keep waiting
                        if (isStopActive || isStreaming || isPlaceholderActive || isTurnGenerating || !isLoaded) {
                            return {
                                isBusy: true,
                                phase: isLoaded ? 'finishing_generation' : 'rendering_image_pixels',
                                src: candidateImg.src || candidateImg.currentSrc,
                                width: candidateImg.naturalWidth,
                                height: candidateImg.naturalHeight
                            };
                        }

                        // Generation is 100% finished and brand-new image is fully loaded!
                        return {
                            isBusy: false,
                            isComplete: true,
                            src: candidateImg.src || candidateImg.currentSrc,
                            width: candidateImg.naturalWidth,
                            height: candidateImg.naturalHeight
                        };
                    }
                """, {
                    "priorSrcs": prior_srcs_list,
                    "minGenPassed": elapsed >= MIN_GEN_SECONDS
                })

                if gen_status.get("isError"):
                    err_msg = gen_status.get("errorText", "ChatGPT returned an error during generation.")
                    raise Exception(f"ChatGPT generation error: {err_msg}")

                if not gen_status.get("isBusy") and gen_status.get("isComplete"):
                    target_image_src = gen_status.get("src")
                    elapsed_total = int(time.time() - start_gen_time)
                    print(f"[Playwright] Scene {scene_id} NEW image ready in {elapsed_total}s! ({gen_status.get('width')}x{gen_status.get('height')})")
                    break
            else:
                raise Exception(f"Timed out after {timeout_seconds}s waiting for ChatGPT image generation to complete.")

            # Record this image URL in seen_image_urls immediately
            if target_image_src:
                self.seen_image_urls.add(target_image_src)

            # Step 5: High-Res Image Extraction (Multi-Strategy Fail-Safe)
            await asyncio.sleep(1.0)
            downloaded_bytes: Optional[bytes] = None

            # --- Strategy 1: Direct CDN fetch via page.request (Fastest & Full Original Resolution) ---
            if target_image_src and (target_image_src.startswith("http://") or target_image_src.startswith("https://")):
                try:
                    print(f"[Playwright] Attempting Strategy 1: Direct CDN fetch via page.request...")
                    req_res = await self.page.request.get(target_image_src, timeout=15000)
                    if req_res.ok:
                        data = await req_res.body()
                        if len(data) > 5000:
                            pil = Image.open(io.BytesIO(data))
                            if pil.width >= 200 and pil.height >= 200:
                                downloaded_bytes = data
                                print(f"[Playwright] ✅ Strategy 1 succeeded: {len(data)} bytes ({pil.width}x{pil.height})")
                except Exception as s1_err:
                    print(f"[Playwright] Strategy 1 note: {s1_err}")

            # --- Strategy 2: In-Page HTML5 Canvas Pixel Extraction ---
            if (not downloaded_bytes or len(downloaded_bytes) < 5000) and target_image_src:
                try:
                    print(f"[Playwright] Attempting Strategy 2: HTML5 Canvas direct pixel export...")
                    canvas_b64 = await self.page.evaluate("""
                        (targetSrc) => {
                            try {
                                const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                                    const s = img.src || img.currentSrc || '';
                                    return s === targetSrc || (targetSrc && s.includes(targetSrc.slice(0, 50)));
                                });
                                const img = imgs.length > 0 ? imgs[imgs.length - 1] : document.querySelector('article[data-testid^="conversation-turn-"]:last-of-type img');
                                if (!img || !img.complete || img.naturalWidth < 100) return null;
                                
                                const canvas = document.createElement('canvas');
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                const dataUrl = canvas.toDataURL('image/png');
                                return dataUrl.split(',')[1];
                            } catch (e) {
                                return null;
                            }
                        }
                    """, target_image_src)
                    if canvas_b64:
                        data = base64.b64decode(canvas_b64)
                        if len(data) > 5000:
                            pil = Image.open(io.BytesIO(data))
                            if pil.width >= 200 and pil.height >= 200:
                                downloaded_bytes = data
                                print(f"[Playwright] ✅ Strategy 2 (Canvas) succeeded: {len(data)} bytes ({pil.width}x{pil.height})")
                except Exception as s2_err:
                    print(f"[Playwright] Strategy 2 note: {s2_err}")

            # --- Strategy 3: Browser In-Page fetch -> Base64 ---
            if (not downloaded_bytes or len(downloaded_bytes) < 5000) and target_image_src:
                try:
                    print(f"[Playwright] Attempting Strategy 3: Browser in-page fetch to base64...")
                    image_base64 = await self.page.evaluate("""
                        async (src) => {
                            try {
                                const res = await fetch(src, { credentials: 'include' });
                                const blob = await res.blob();
                                return new Promise((resolve) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        const b64 = reader.result ? reader.result.toString().split(',')[1] : null;
                                        resolve(b64);
                                    };
                                    reader.readAsDataURL(blob);
                                });
                            } catch (e) {
                                return null;
                            }
                        }
                    """, target_image_src)
                    if image_base64:
                        data = base64.b64decode(image_base64)
                        if len(data) > 5000:
                            pil = Image.open(io.BytesIO(data))
                            if pil.width >= 200 and pil.height >= 200:
                                downloaded_bytes = data
                                print(f"[Playwright] ✅ Strategy 3 succeeded: {len(data)} bytes ({pil.width}x{pil.height})")
                except Exception as s3_err:
                    print(f"[Playwright] Strategy 3 note: {s3_err}")

            # --- Strategy 4: Playwright Native Element Screenshot ---
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    print(f"[Playwright] Attempting Strategy 4: Playwright element screenshot...")
                    img_locators = self.page.locator('article[data-testid^="conversation-turn-"] img, div[data-message-author-role="assistant"] img, main img')
                    count = await img_locators.count()
                    if count > 0:
                        target_loc = img_locators.nth(count - 1)
                        await target_loc.scroll_into_view_if_needed()
                        await asyncio.sleep(0.4)
                        ss_bytes = await target_loc.screenshot(type="png")
                        if ss_bytes and len(ss_bytes) > 5000:
                            pil = Image.open(io.BytesIO(ss_bytes))
                            if pil.width >= 200 and pil.height >= 200:
                                downloaded_bytes = ss_bytes
                                print(f"[Playwright] ✅ Strategy 4 succeeded: {len(ss_bytes)} bytes ({pil.width}x{pil.height})")
                except Exception as s4_err:
                    print(f"[Playwright] Strategy 4 note: {s4_err}")

            # --- Strategy 5: Lightbox Modal Download Button ---
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    print(f"[Playwright] Attempting Strategy 5: Lightbox modal download...")
                    img_locators = self.page.locator('article[data-testid^="conversation-turn-"] img, div[data-message-author-role="assistant"] img, main img')
                    count = await img_locators.count()
                    if count > 0:
                        await img_locators.nth(count - 1).click()
                        await asyncio.sleep(1.2)
                        dl_btn = self.page.locator('button[aria-label*="Download" i], a[download], button:has-text("Download")').first
                        if await dl_btn.count() > 0:
                            async with self.page.expect_download(timeout=10000) as dl_info:
                                await dl_btn.click()
                            dl = await dl_info.value
                            temp_path = self.profile_dir / f"temp_{scene_id}_{int(time.time())}.png"
                            await dl.save_as(str(temp_path))
                            if temp_path.exists():
                                with open(temp_path, "rb") as f:
                                    downloaded_bytes = f.read()
                                temp_path.unlink(missing_ok=True)
                                print(f"[Playwright] ✅ Strategy 5 succeeded: {len(downloaded_bytes)} bytes")
                        await self.page.keyboard.press("Escape")
                except Exception as s5_err:
                    print(f"[Playwright] Strategy 5 note: {s5_err}")
                    await self.page.keyboard.press("Escape")

            # Validate final image integrity with PIL
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                raise Exception("Failed to retrieve valid image bytes from ChatGPT across all extraction strategies.")

            try:
                pil_img = Image.open(io.BytesIO(downloaded_bytes))
                if pil_img.width < 100 or pil_img.height < 100:
                    raise Exception(f"Extracted image is too small ({pil_img.width}x{pil_img.height})")
            except Exception as pil_err:
                raise Exception(f"Extracted image file corrupted: {pil_err}")

            # Clean UI state
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.5)

            # Step 6: Save and assign to project scene
            scene = image_service.assign_image_to_scene(
                project_id,
                scene_id,
                downloaded_bytes,
                f"chatgpt_scene_{scene_id}.png"
            )
            print(f"[Playwright] 🚀 Scene {scene_id} successfully saved and attached to project!")
            return scene.model_dump()

        except Exception as e:
            print(f"[Playwright] Generation error for scene {scene_id}: {e}")
            raise e

playwright_chatgpt_service = PlaywrightChatGPTService()
