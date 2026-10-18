import os
import sys
import io
import time
import base64
import asyncio
from pathlib import Path
from typing import Dict, Any, Optional, List, Set
from PIL import Image
from app.services.image_service import image_service

class PlaywrightGeminiService:
    def __init__(self):
        self.playwright = None
        self.browser_context = None
        self.page = None
        self.is_running = False
        self.profile_dir = Path.home() / ".storyreel" / "gemini_profile"
        self.profile_dir.mkdir(parents=True, exist_ok=True)
        self.seen_image_urls: Set[str] = set()

    async def open_browser(self) -> Dict[str, Any]:
        """
        Launches a persistent Chrome browser window for Google Gemini with native Chrome
        """
        try:
            if self.browser_context and self.page and not self.page.is_closed():
                await self.page.bring_to_front()
                return {"status": "open", "message": "Gemini browser window is already active."}

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
            if "gemini.google.com" not in current_url:
                await self.page.goto("https://gemini.google.com/app", wait_until="domcontentloaded")

            self.is_running = True
            return {"status": "open", "message": "Gemini browser window is ready! Log in to Google if needed."}
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
                await self.page.goto("https://gemini.google.com/app", wait_until="domcontentloaded")
                self.is_running = True
                return {"status": "open", "message": "Gemini browser window ready!"}
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
        2. Types prompt into Gemini prompt area and confirms submission
        3. Strictly monitors generation state (ensures Imagen produces a BRAND-NEW image)
        4. Accurately verifies that image generation is 100% complete
        5. Extracts high-resolution image using fail-safe strategies (Direct CDN, Canvas Export, Base64, Screenshot)
        6. Validates image integrity and assigns directly to project scene
        """
        if not self.page or self.page.is_closed():
            res = await self.open_browser()
            if res.get("status") == "error":
                raise Exception(res.get("message"))

        try:
            # Ensure we are on Gemini
            current_url = self.page.url
            if "gemini.google.com" not in current_url:
                await self.page.goto("https://gemini.google.com/app", wait_until="domcontentloaded")
                await asyncio.sleep(2.0)

            # Ensure prompt triggers image generation in Gemini (Imagen 3)
            clean_prompt = prompt.strip()
            lower_prompt = clean_prompt.lower()
            if not any(lower_prompt.startswith(p) for p in [
                "generate an image", "generate image", "create an image", "create image",
                "draw an image", "draw image", "make an image", "make image", "paint an image", "paint image"
            ]):
                effective_prompt = f"Generate a cinematic image: {clean_prompt}"
            else:
                effective_prompt = clean_prompt

            # Step 1: Capture existing images on page prior to sending prompt
            pre_info = await self.page.evaluate("""
                () => {
                    const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                        const s = img.src || img.currentSrc || '';
                        if (!s) return false;
                        if (s.includes('avatar') || s.includes('profile') || s.includes('svg') || s.includes('gravatar') || s.includes('favicon') || s.includes('sparkle') || s.includes('google-logo')) return false;
                        return s.startsWith('http') || s.startsWith('blob:') || s.startsWith('data:image');
                    });
                    const turns = document.querySelectorAll('message-content, model-response, [data-test-id*="conversation-turn"], div[class*="response-container"], article');
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
            print(f"[Playwright-Gemini] Scene {scene_id}: Prior image count = {len(prior_srcs_list)}, Prior turns = {prior_turn_count}")

            # Close any open lightboxes or popups
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.3)

            # Scroll to bottom so input is in view
            await self.page.evaluate("""
                () => {
                    window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' });
                    const m = document.querySelector('main, infinite-scroller, .chat-history, .conversation-container');
                    if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'instant' });
                }
            """)
            await asyncio.sleep(0.3)

            # Step 2: Focus and inject prompt (100% TrustedHTML / CSP compliant)
            input_selector = (
                'rich-textarea div[contenteditable="true"], '
                'rich-textarea p, '
                '.ql-editor[contenteditable="true"], '
                '.ql-editor, '
                'div[role="textbox"][contenteditable="true"], '
                'div[contenteditable="true"], '
                'textarea'
            )

            # Native Playwright focus and keyboard input (safest, triggers all framework events without innerHTML)
            prompt_locator = self.page.locator(input_selector).first
            await prompt_locator.wait_for(timeout=15000)
            await prompt_locator.click()
            await asyncio.sleep(0.2)

            select_all = "Meta+A" if sys.platform == "darwin" else "Control+A"
            await self.page.keyboard.press(select_all)
            await self.page.keyboard.press("Backspace")
            await asyncio.sleep(0.1)
            await self.page.keyboard.insert_text(effective_prompt)
            await asyncio.sleep(0.4)

            # Verify if text was entered; if not, use Trusted Types safe fallback
            has_text = await self.page.evaluate("""
                (sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return false;
                    const text = el.innerText || el.textContent || el.value || '';
                    return text.trim().length > 5;
                }
            """, input_selector)

            if not has_text:
                await self.page.evaluate("""
                    ({ sel, text }) => {
                        const el = document.querySelector(sel);
                        if (!el) return;
                        el.focus();
                        if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                            el.value = text;
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        } else {
                            // Trusted Types safe: create text node/element without innerHTML
                            const p = document.createElement('p');
                            p.textContent = text;
                            if (typeof el.replaceChildren === 'function') {
                                el.replaceChildren(p);
                            } else {
                                while (el.firstChild) el.removeChild(el.firstChild);
                                el.appendChild(p);
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            el.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                """, {"sel": input_selector, "text": effective_prompt})
                await asyncio.sleep(0.3)

            await asyncio.sleep(0.5)

            # Step 3: Submit prompt
            submitted = await self.page.evaluate("""
                () => {
                    const sendBtn = document.querySelector('button[aria-label*="Send" i], button[aria-label*="Submit" i], button.send-button, button[mattooltip*="Send" i], button[data-test-id*="send" i], button:has(mat-icon[fonticon*="send" i])');
                    if (sendBtn && !sendBtn.disabled && window.getComputedStyle(sendBtn).display !== 'none') {
                        sendBtn.click();
                        return true;
                    }
                    return false;
                }
            """)

            if not submitted:
                send_btn = await self.page.query_selector('button[aria-label*="Send" i], button.send-button, button[mattooltip*="Send" i]')
                if send_btn and await send_btn.is_enabled():
                    await send_btn.click()
                else:
                    await self.page.keyboard.press("Enter")

            print(f"[Playwright-Gemini] Scene {scene_id} prompt submitted. Waiting for Gemini to begin processing...")
            await asyncio.sleep(2.0)

            # Verify if input still contains full text (if so, retry submit via Enter key)
            is_still_in_input = await self.page.evaluate("""
                (sel) => {
                    const el = document.querySelector(sel);
                    if (!el) return false;
                    const text = el.innerText || el.textContent || el.value || '';
                    return text.trim().length > 10;
                }
            """, input_selector)
            if is_still_in_input:
                print(f"[Playwright-Gemini] Scene {scene_id}: Retrying submit via Enter key...")
                prompt_loc = self.page.locator(input_selector).first
                if await prompt_loc.count() > 0:
                    await prompt_loc.click()
                    await self.page.keyboard.press("Enter")
                await asyncio.sleep(2.0)

            # Step 4: Actively monitor generation until BRAND NEW image is 100% complete
            print(f"[Playwright-Gemini] Scene {scene_id}: Monitoring Gemini generation (timeout: {timeout_seconds}s)...")
            start_gen_time = time.time()
            target_image_src = None
            last_scroll_time = 0
            MIN_GEN_SECONDS = 5

            while time.time() - start_gen_time < timeout_seconds:
                await asyncio.sleep(1.8)
                elapsed = time.time() - start_gen_time

                # Keep scrolling to bottom so newly rendered items load into DOM
                if time.time() - last_scroll_time > 2.5:
                    last_scroll_time = time.time()
                    await self.page.evaluate("""
                        () => {
                            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                            const m = document.querySelector('main, infinite-scroller, .chat-history, .conversation-container');
                            if (m) m.scrollTo({ top: m.scrollHeight, behavior: 'smooth' });
                        }
                    """)

                gen_status = await self.page.evaluate("""
                    ({ priorSrcs, minGenPassed }) => {
                        const priorSet = new Set(priorSrcs);

                        // 1. Check for assistant error messages in the last turn
                        const turns = Array.from(document.querySelectorAll('message-content, model-response, [data-test-id*="conversation-turn"], div[class*="response-container"], article'));
                        if (turns.length > 0) {
                            const lastTurn = turns[turns.length - 1];
                            const turnText = (lastTurn.innerText || '').toLowerCase();
                            if (turnText.includes("i can't help with that") || 
                                turnText.includes("i cannot generate that") || 
                                turnText.includes("content policy") || 
                                turnText.includes("safety guidelines") || 
                                turnText.includes("violates our") ||
                                turnText.includes("error generating image") ||
                                turnText.includes("rate limit exceeded") ||
                                turnText.includes("quota exceeded") ||
                                turnText.includes("too many requests")) {
                                return { isError: true, errorText: lastTurn.innerText.slice(0, 300) };
                            }
                        }

                        // 2. Check for ACTIVE, VISIBLE stop generating button only
                        const stopBtns = Array.from(document.querySelectorAll('button[aria-label*="Stop" i], button[data-test-id="stop-button"], button[mattooltip*="Stop" i]'));
                        const isStopActive = stopBtns.some(b => {
                            const r = b.getBoundingClientRect();
                            return r.width > 0 && r.height > 0 && window.getComputedStyle(b).display !== 'none' && window.getComputedStyle(b).visibility !== 'hidden';
                        });

                        // 3. Check for ACTIVE, VISIBLE progress spinners only
                        const spinners = Array.from(document.querySelectorAll('mat-progress-spinner, mat-spinner, [data-test-id="loading-spinner"]'));
                        const isSpinning = spinners.some(s => {
                            const r = s.getBoundingClientRect();
                            return r.width > 0 && r.height > 0 && window.getComputedStyle(s).display !== 'none' && window.getComputedStyle(s).visibility !== 'hidden';
                        });

                        // 4. Find all candidate generated images on page (excluding avatars, icons, SVGs)
                        const allImgs = Array.from(document.querySelectorAll('img')).filter(img => {
                            const s = img.src || img.currentSrc || img.getAttribute('src') || '';
                            if (!s) return false;
                            if (s.includes('/a/') || s.includes('/a-/') || s.includes('avatar') || s.includes('profile') || 
                                s.includes('favicon') || s.includes('sparkle') || s.includes('google-logo') || s.includes('.svg')) {
                                return false;
                            }
                            const nw = img.naturalWidth || 0;
                            const nh = img.naturalHeight || 0;
                            const r = img.getBoundingClientRect();
                            const rw = r.width || 0;
                            const rh = r.height || 0;
                            return (nw >= 150 && nh >= 150) || (rw >= 150 && rh >= 150);
                        });

                        // Filter out images that existed prior to sending this prompt
                        const newImgs = allImgs.filter(img => {
                            const s = img.src || '';
                            const cs = img.currentSrc || '';
                            const as = img.getAttribute('src') || '';
                            const inS = s ? priorSet.has(s) : false;
                            const inCs = cs ? priorSet.has(cs) : false;
                            const inAs = as ? priorSet.has(as) : false;
                            return !inS && !inCs && !inAs;
                        });

                        // If no new generated image has appeared yet
                        if (newImgs.length === 0) {
                            return {
                                isBusy: true,
                                phase: 'waiting_for_new_image',
                                isStopActive,
                                isSpinning,
                                newImgsCount: 0
                            };
                        }

                        // Candidate is the latest generated image
                        const candidate = newImgs[newImgs.length - 1];
                        // Tag it directly in DOM for instant, 100% accurate locator selection
                        candidate.setAttribute('data-storyreel-target', 'true');

                        const nw = candidate.naturalWidth || candidate.width || 0;
                        const nh = candidate.naturalHeight || candidate.height || 0;
                        const isLoaded = candidate.complete && (nw >= 150 && nh >= 150);

                        // Enforce minimum grace period (AI image generation takes > 4s)
                        if (!minGenPassed) {
                            return { isBusy: true, phase: 'initial_grace_period', src: candidate.src || candidate.currentSrc };
                        }

                        // Still generating if stop button is active, spinner is visible, or pixels not loaded
                        if (isStopActive || isSpinning || !isLoaded) {
                            return {
                                isBusy: true,
                                phase: isLoaded ? 'finishing_generation' : 'loading_pixels',
                                src: candidate.src || candidate.currentSrc,
                                width: nw,
                                height: nh
                            };
                        }

                        // Image generation is 100% complete and pixels are loaded!
                        return {
                            isBusy: false,
                            isComplete: true,
                            src: candidate.src || candidate.currentSrc || candidate.getAttribute('src'),
                            width: nw,
                            height: nh
                        };
                    }
                """, {
                    "priorSrcs": prior_srcs_list,
                    "minGenPassed": elapsed >= MIN_GEN_SECONDS
                })

                if gen_status.get("isError"):
                    err_msg = gen_status.get("errorText", "Gemini returned an error during generation.")
                    raise Exception(f"Gemini generation error: {err_msg}")

                if not gen_status.get("isBusy") and gen_status.get("isComplete"):
                    target_image_src = gen_status.get("src")
                    elapsed_total = int(time.time() - start_gen_time)
                    print(f"[Playwright-Gemini] Scene {scene_id} NEW image ready in {elapsed_total}s! ({gen_status.get('width')}x{gen_status.get('height')})")
                    break
            else:
                raise Exception(f"Timed out after {timeout_seconds}s waiting for Gemini image generation to complete.")

            # Record this image URL in seen_image_urls immediately
            if target_image_src:
                self.seen_image_urls.add(target_image_src)

            # Step 5: High-Res Image Extraction (Multi-Strategy Fail-Safe)
            await asyncio.sleep(0.8)
            downloaded_bytes: Optional[bytes] = None

            # --- Strategy 0: Direct Data URL / Base64 decode ---
            if target_image_src and target_image_src.startswith("data:image/"):
                try:
                    print(f"[Playwright-Gemini] Attempting Strategy 0: Base64 data URL decode...")
                    if "," in target_image_src:
                        raw_b64 = target_image_src.split(",", 1)[1]
                        data = base64.b64decode(raw_b64)
                        if len(data) > 5000:
                            pil = Image.open(io.BytesIO(data))
                            if pil.width >= 150 and pil.height >= 150:
                                downloaded_bytes = data
                                print(f"[Playwright-Gemini] ✅ Strategy 0 succeeded: {len(data)} bytes ({pil.width}x{pil.height})")
                except Exception as s0_err:
                    print(f"[Playwright-Gemini] Strategy 0 note: {s0_err}")

            # --- Strategy 1: Direct CDN fetch via page.request with Full Google Referer Headers ---
            if (not downloaded_bytes or len(downloaded_bytes) < 5000) and target_image_src and (target_image_src.startswith("http://") or target_image_src.startswith("https://")):
                try:
                    print(f"[Playwright-Gemini] Attempting Strategy 1: Direct CDN fetch via page.request with Referer headers...")
                    ua = await self.page.evaluate("navigator.userAgent")
                    req_res = await self.page.request.get(
                        target_image_src,
                        headers={
                            "Referer": "https://gemini.google.com/",
                            "User-Agent": ua,
                            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                            "Sec-Fetch-Dest": "image",
                            "Sec-Fetch-Mode": "no-cors",
                            "Sec-Fetch-Site": "cross-site",
                        },
                        timeout=15000
                    )
                    if req_res.ok:
                        data = await req_res.body()
                        if len(data) > 5000:
                            pil = Image.open(io.BytesIO(data))
                            if pil.width >= 150 and pil.height >= 150:
                                downloaded_bytes = data
                                print(f"[Playwright-Gemini] ✅ Strategy 1 succeeded: {len(data)} bytes ({pil.width}x{pil.height})")
                except Exception as s1_err:
                    print(f"[Playwright-Gemini] Strategy 1 note: {s1_err}")

            # --- Strategy 2: Playwright Native Element Screenshot of Tagged Target Image ---
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    print(f"[Playwright-Gemini] Attempting Strategy 2: Playwright native element screenshot of tagged target...")
                    target_loc = self.page.locator('img[data-storyreel-target="true"]').last
                    if await target_loc.count() == 0 or not await target_loc.is_visible():
                        # Re-tag the latest large image on page if attribute was cleared
                        await self.page.evaluate("""
                            () => {
                                const imgs = Array.from(document.querySelectorAll('img')).filter(img => {
                                    const s = img.src || img.currentSrc || '';
                                    if (!s || s.includes('avatar') || s.includes('profile') || s.includes('/a/') || s.includes('favicon') || s.includes('.svg')) return false;
                                    const w = img.naturalWidth || img.width || 0;
                                    const h = img.naturalHeight || img.height || 0;
                                    return w >= 150 && h >= 150;
                                });
                                if (imgs.length > 0) {
                                    imgs[imgs.length - 1].setAttribute('data-storyreel-target', 'true');
                                }
                            }
                        """)
                        target_loc = self.page.locator('img[data-storyreel-target="true"]').last

                    if await target_loc.count() > 0:
                        await target_loc.scroll_into_view_if_needed()
                        await asyncio.sleep(0.4)
                        ss_bytes = await target_loc.screenshot(type="png")
                        if ss_bytes and len(ss_bytes) > 5000:
                            pil = Image.open(io.BytesIO(ss_bytes))
                            if pil.width >= 150 and pil.height >= 150:
                                downloaded_bytes = ss_bytes
                                print(f"[Playwright-Gemini] ✅ Strategy 2 (Native Element Screenshot) succeeded: {len(ss_bytes)} bytes ({pil.width}x{pil.height})")
                except Exception as s2_err:
                    print(f"[Playwright-Gemini] Strategy 2 note: {s2_err}")

            # --- Strategy 3: Click Image to Open Lightbox & Extract / Download ---
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    print(f"[Playwright-Gemini] Attempting Strategy 3: Open lightbox dialog & download...")
                    target_loc = self.page.locator('img[data-storyreel-target="true"]').last
                    if await target_loc.count() > 0:
                        await target_loc.click()
                        await asyncio.sleep(1.0)
                        
                        # Look for download button inside modal
                        dl_btn = self.page.locator('button[aria-label*="Download" i], button:has(mat-icon[fonticon*="download" i]), a[download]').first
                        if await dl_btn.count() > 0 and await dl_btn.is_visible():
                            async with self.page.expect_download(timeout=10000) as dl_info:
                                await dl_btn.click()
                            dl = await dl_info.value
                            temp_path = self.profile_dir / f"temp_{scene_id}_{int(time.time())}.png"
                            await dl.save_as(str(temp_path))
                            if temp_path.exists():
                                with open(temp_path, "rb") as f:
                                    downloaded_bytes = f.read()
                                temp_path.unlink(missing_ok=True)
                                print(f"[Playwright-Gemini] ✅ Strategy 3 (Download button) succeeded: {len(downloaded_bytes)} bytes")

                        # If download button wasn't clicked, try screenshotting modal image
                        if not downloaded_bytes or len(downloaded_bytes) < 5000:
                            modal_img = self.page.locator('dialog img, mat-dialog-container img, div[role="dialog"] img, .lightbox img').first
                            if await modal_img.count() > 0 and await modal_img.is_visible():
                                m_ss = await modal_img.screenshot(type="png")
                                if m_ss and len(m_ss) > 5000:
                                    pil = Image.open(io.BytesIO(m_ss))
                                    if pil.width >= 150 and pil.height >= 150:
                                        downloaded_bytes = m_ss
                                        print(f"[Playwright-Gemini] ✅ Strategy 3 (Modal Screenshot) succeeded: {len(m_ss)} bytes ({pil.width}x{pil.height})")

                        await self.page.keyboard.press("Escape")
                        await asyncio.sleep(0.4)
                except Exception as s3_err:
                    print(f"[Playwright-Gemini] Strategy 3 note: {s3_err}")
                    await self.page.keyboard.press("Escape")

            # --- Strategy 4: Largest Image on Page Screenshot Fallback ---
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                try:
                    print(f"[Playwright-Gemini] Attempting Strategy 4: Largest visible image screenshot fallback...")
                    best_info = await self.page.evaluate("""
                        () => {
                            const imgs = Array.from(document.querySelectorAll('img'));
                            let bestIdx = -1;
                            let maxArea = 0;
                            imgs.forEach((img, idx) => {
                                const s = img.src || img.currentSrc || '';
                                if (!s || s.includes('avatar') || s.includes('profile') || s.includes('/a/') || s.includes('.svg')) return;
                                const nw = img.naturalWidth || 0;
                                const nh = img.naturalHeight || 0;
                                const r = img.getBoundingClientRect();
                                const w = nw > 0 ? nw : r.width;
                                const h = nh > 0 ? nh : r.height;
                                const area = w * h;
                                if (area > maxArea && (w >= 150 || r.width >= 150)) {
                                    maxArea = area;
                                    bestIdx = idx;
                                }
                            });
                            return bestIdx;
                        }
                    """)
                    if best_info is not None and best_info >= 0:
                        fallback_loc = self.page.locator('img').nth(best_info)
                        await fallback_loc.scroll_into_view_if_needed()
                        await asyncio.sleep(0.3)
                        fb_ss = await fallback_loc.screenshot(type="png")
                        if fb_ss and len(fb_ss) > 5000:
                            pil = Image.open(io.BytesIO(fb_ss))
                            if pil.width >= 150 and pil.height >= 150:
                                downloaded_bytes = fb_ss
                                print(f"[Playwright-Gemini] ✅ Strategy 4 (Largest Image Fallback) succeeded: {len(fb_ss)} bytes ({pil.width}x{pil.height})")
                except Exception as s4_err:
                    print(f"[Playwright-Gemini] Strategy 4 note: {s4_err}")

            # Validate final image integrity with PIL
            if not downloaded_bytes or len(downloaded_bytes) < 5000:
                raise Exception("Failed to retrieve valid image bytes from Gemini across all extraction strategies.")

            try:
                pil_img = Image.open(io.BytesIO(downloaded_bytes))
                if pil_img.width < 100 or pil_img.height < 100:
                    raise Exception(f"Extracted image is too small ({pil_img.width}x{pil_img.height})")
            except Exception as pil_err:
                raise Exception(f"Extracted image file corrupted: {pil_err}")

            # Clean UI state
            await self.page.keyboard.press("Escape")
            await asyncio.sleep(0.4)

            # Step 6: Save and assign to project scene
            scene = image_service.assign_image_to_scene(
                project_id,
                scene_id,
                downloaded_bytes,
                f"gemini_scene_{scene_id}.png"
            )
            print(f"[Playwright-Gemini] 🚀 Scene {scene_id} successfully saved and attached to project!")
            return scene.model_dump()

        except Exception as e:
            print(f"[Playwright-Gemini] Generation error for scene {scene_id}: {e}")
            raise e

playwright_gemini_service = PlaywrightGeminiService()
