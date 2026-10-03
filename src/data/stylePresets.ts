export interface StylePreset {
  id: string;
  name: string;
  badge: string;
  desc: string;
  gradient: string;
  art_medium: string;
  lighting: string;
  color_palette: string;
  camera_lens: string;
  negative_prompt: string;
  custom_description?: string;
  prompt_lead: string;
  quality_suffix: string;
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cinematic_realistic',
    name: 'Cinematic Realistic (35mm Movie Still)',
    badge: 'Popular',
    desc: 'Dramatic 35mm anamorphic lighting, photorealistic depth of field, 8K movie still',
    gradient: 'from-blue-600 to-indigo-900',
    art_medium: '35mm anamorphic photography, photorealistic 8k movie still, ultra detailed, Panavision lens',
    lighting: 'dramatic volumetric cinematic lighting, subtle atmospheric haze, natural rim light',
    color_palette: 'rich color grading, natural tones, cinematic teal and orange shadow accents',
    camera_lens: '35mm anamorphic prime lens, shallow depth of field, f/1.8 aperture bokeh',
    negative_prompt: 'cartoon, anime, 3d render, drawing, blurry, low quality, deformed anatomy, extra limbs, bad hands, watermark, text',
    prompt_lead: 'Cinematic 35mm movie still, {shot_type} shot of',
    quality_suffix: 'photorealistic 8k movie still, cinematic atmosphere, masterpiece cinematography',
  },
  {
    id: 'anime_ghibli',
    name: 'Anime / Studio Ghibli (Hand-drawn 2D)',
    badge: 'Vibrant',
    desc: 'Hand-drawn anime aesthetic, lush landscapes, soft watercolor clouds, Studio Ghibli & Makoto Shinkai style',
    gradient: 'from-emerald-600 to-teal-900',
    art_medium: 'Japanese anime illustration, Studio Ghibli aesthetic, Makoto Shinkai style, hand-drawn 2D animation cel, painterly gouache background',
    lighting: 'soft golden sunbeams, ethereal luminescent lighting, vibrant god rays, atmospheric bloom',
    color_palette: 'vibrant lush greens, bright sky blues, warm pastel tones, rich hand-painted colors',
    camera_lens: 'dynamic anime cinematic composition, wide angle anime framing, cel-shaded depth',
    negative_prompt: 'photorealistic, 3d render, cgi, real life photo, blurry, bad anatomy, deformed eyes, watermark, signature',
    prompt_lead: 'Hand-drawn Studio Ghibli anime illustration, {shot_type} key visual of',
    quality_suffix: 'Studio Ghibli anime masterpiece, Makoto Shinkai aesthetic, key visual, 2D animation art, highly detailed',
  },
  {
    id: '3d_pixar',
    name: '3D Pixar / Disney (Stylized 3D Animation)',
    badge: 'Stylized',
    desc: 'High-end 3D animated movie render, expressive character design, soft subsurface scattering clay render',
    gradient: 'from-amber-500 to-orange-800',
    art_medium: '3D Pixar Disney animation style, stylized character design, smooth subsurface scattering clay render, Octane render 3D',
    lighting: 'warm inviting studio key lighting, soft rim light, gentle ambient occlusion',
    color_palette: 'rich saturated cheerful colors, warm whimsical palette, Pixar color script',
    camera_lens: 'virtual 50mm animated camera lens, clean cinematic depth of field, smooth rendering',
    negative_prompt: 'photorealistic, live action photo, flat 2d anime, ugly, deformed, dark, gritty, noisy, low resolution, watermark',
    prompt_lead: '3D Pixar Disney animated movie render, {shot_type} shot of',
    quality_suffix: 'Pixar Disney 3D animation render, Octane Render, Ray Tracing, 8k resolution, stylized 3D masterpiece',
  },
  {
    id: 'dark_horror',
    name: 'Dark Gothic / Horror',
    badge: 'Moody',
    desc: 'Atmospheric fog, chiaroscuro lighting, desaturated grim palette, eerie gothic realism',
    gradient: 'from-purple-900 to-zinc-950',
    art_medium: 'dark gothic realism, sinister atmospheric concept art, eerie cinematic mood',
    lighting: 'dramatic chiaroscuro lighting, deep harsh shadows, creeping mist, candle glow, moonlight rim',
    color_palette: 'desaturated muted grim tones, blood red accents, cold obsidian blacks, ghostly blues',
    camera_lens: '24mm wide angle perspective, Dutch angle framing, unsettling claustrophobic depth',
    negative_prompt: 'bright, cheerful, cartoon, anime, saturated colors, low quality, bad anatomy, text, watermark',
    prompt_lead: 'Dark gothic eerie {shot_type} shot of',
    quality_suffix: 'dark gothic horror cinematic still, eerie atmospheric masterpiece, 8k, ultra detailed',
  },
  {
    id: 'watercolor',
    name: 'Watercolor Storybook',
    badge: 'Artistic',
    desc: 'Delicate watercolor washes, expressive ink outlines, fairytale storybook illustration',
    gradient: 'from-rose-500 to-purple-800',
    art_medium: 'delicate watercolor painting on textured rough cotton paper, fine expressive ink linework, fairytale storybook illustration',
    lighting: 'soft diffuse morning watercolor wash, gentle pastel luminescence, dappled sunlight',
    color_palette: 'dreamy pastel watercolors, soft lavender, mint green, blush pink, golden ochre',
    camera_lens: 'storybook illustration composition, artistic vignette border, whimsical framing',
    negative_prompt: 'photorealistic, 3d cgi render, dark, gritty, harsh shadows, neon, deformed, watermark, text',
    prompt_lead: 'Delicate watercolor fairytale illustration on textured paper, {shot_type} view of',
    quality_suffix: 'traditional watercolor storybook illustration, wet-on-wet technique, fine ink outlines, artistic masterpiece',
  },
  {
    id: 'cyberpunk_retro',
    name: 'Retro 80s Cyberpunk',
    badge: 'Neon',
    desc: 'Neon glow, synthwave reflections, dystopian rain, futuristic retro cinematic look',
    gradient: 'from-cyan-500 to-fuchsia-800',
    art_medium: 'cyberpunk synthwave aesthetic, dystopian sci-fi cinematic render, wet asphalt reflections, retro-futurism',
    lighting: 'vibrant neon glow, electric cyan and hot magenta backlights, volumetric laser beams, holographic illumination',
    color_palette: 'electric cyan, hot neon pink, deep midnight purple, glowing amber, dark chrome',
    camera_lens: 'anamorphic lens with prominent horizontal neon flares, moody rain-slicked perspective',
    negative_prompt: 'daylight, medieval, cartoon, flat colors, low detail, blurry, deformed anatomy, bad hands, watermark',
    prompt_lead: 'Cyberpunk retro-futuristic {shot_type} shot of',
    quality_suffix: 'cyberpunk synthwave masterpiece, neon city aesthetic, Unreal Engine 5 render, 8k wallpaper',
  },
  {
    id: 'oil_painting',
    name: 'Classic Oil Painting (Impasto Canvas)',
    badge: 'Masterpiece',
    desc: 'Masterpiece oil on canvas, thick impasto brushstrokes, Rembrandt chiaroscuro lighting, rich Venetian colors',
    gradient: 'from-amber-700 to-yellow-950',
    art_medium: 'fine oil painting on heavy canvas, visible thick impasto brushstrokes, classical fine art masterpiece, Rembrandt style',
    lighting: 'dramatic golden hour Rembrandt lighting, directional master light, rich warm glow',
    color_palette: 'rich Venetian oil palette, deep umber, ochre, royal crimson, burnished gold',
    camera_lens: 'classical fine art canvas composition, painterly atmospheric perspective',
    negative_prompt: 'digital photo, 3d render, anime, cartoon, flat vector, modern, low quality, watermark, text',
    prompt_lead: 'Classic fine art oil painting on textured canvas, {shot_type} composition of',
    quality_suffix: 'classical oil painting masterpiece, thick textured brushwork, oil on canvas, gallery fine art',
  },
  {
    id: 'vintage_comic',
    name: 'Vintage Comic Book (Graphic Novel)',
    badge: 'Retro',
    desc: 'Vintage 1980s American comic book art, bold black ink contour lines, Ben-Day halftone dots, graphic novel splash panel',
    gradient: 'from-red-600 to-yellow-600',
    art_medium: 'vintage 1980s American comic book art, bold black ink contour lines, Ben-Day halftone dot pattern, graphic novel splash panel',
    lighting: 'high-contrast comic book graphic lighting, dramatic cell shading, hard edge shadows',
    color_palette: 'bold four-color CMYK printing palette, punchy primary red, cobalt blue, vivid yellow',
    camera_lens: 'dynamic comic panel framing, extreme action angles, bold perspective lines',
    negative_prompt: 'photorealistic, 3d render, soft watercolor, blurry, messy anatomy, watermark, bad linework',
    prompt_lead: 'Vintage graphic novel comic book panel with bold ink outlines and halftone dots, {shot_type} of',
    quality_suffix: 'vintage comic book splash art, graphic novel illustration, Ben-Day dots, master inkwork',
  },
  {
    id: 'hyper_fantasy',
    name: 'Epic Mythological Fantasy',
    badge: 'Epic',
    desc: 'High fantasy concept art, digital matte painting, majestic mythological scale, magical runes and god rays',
    gradient: 'from-indigo-600 to-violet-950',
    art_medium: 'high fantasy concept art, digital matte painting, majestic mythological scale, Lord of the Rings aesthetic',
    lighting: 'magical glowing runes, ethereal celestial light, dramatic god rays piercing clouds',
    color_palette: 'mythic gold, sapphire skies, emerald forests, ancient stone textures',
    camera_lens: 'epic cinematic wide angle, grandiose scale, sweeping atmospheric depth',
    negative_prompt: 'modern, sci-fi, cartoon, anime, low resolution, bad proportions, watermark, text',
    prompt_lead: 'Epic mythological fantasy concept art, {shot_type} shot of',
    quality_suffix: 'epic fantasy matte painting masterpiece, 8k concept art, ArtStation trending, majestic lighting',
  },
  {
    id: 'custom',
    name: 'Custom Art Style',
    badge: 'Custom',
    desc: 'Define your own unique prompt rules, medium, lighting, and camera instructions',
    gradient: 'from-zinc-700 to-zinc-900',
    art_medium: 'custom art style as specified by user prompt',
    lighting: 'custom atmospheric lighting',
    color_palette: 'custom harmonious color palette',
    camera_lens: 'custom lens and camera perspective',
    negative_prompt: 'blurry, low quality, deformed anatomy, extra limbs, bad hands, watermark, signature, text, out of frame',
    prompt_lead: 'Custom artistic {shot_type} composition of',
    quality_suffix: 'highly detailed masterpiece, top tier quality',
  },
];

export function getStylePresetById(id: string): StylePreset {
  const found = STYLE_PRESETS.find((p) => p.id === id);
  return found || STYLE_PRESETS[0];
}

export function getDefaultStyleBible(presetId: string, customDescription?: string) {
  const preset = getStylePresetById(presetId);
  return {
    preset_name: preset.id,
    custom_description: customDescription || (preset.id === 'custom' ? 'Masterpiece custom style' : ''),
    lighting: preset.lighting,
    color_palette: preset.color_palette,
    camera_lens: preset.camera_lens,
    art_medium: preset.art_medium,
    negative_prompt: preset.negative_prompt,
  };
}
