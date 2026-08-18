import editorialRules from '../config/editorial.json';

type JobStatus =
  | 'SELECTED' | 'PARSING' | 'SOURCE_PARSED' | 'COPY_DRAFTING' | 'COPY_DRAFTED'
  | 'COPY_APPROVED' | 'PROMPT_DRAFTING' | 'PROMPT_DRAFTED' | 'IMAGE_GENERATING' | 'IMAGES_GENERATED' | 'RENDERING'
  | 'CHATGPT_DRAFTING' | 'MANUAL_IMAGE_UPLOADING'
  | 'RENDERED' | 'FINAL_APPROVED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'CANCELLED';

type QueueTask =
  | { type: 'dispatch_parse'; jobId: string }
  | { type: 'draft_copy'; jobId: string; instruction?: string }
  | { type: 'draft_visuals'; jobId: string }
  | { type: 'revise_prompts'; jobId: string; instruction: string }
  | { type: 'generate_image'; jobId: string; pageNo: number; variant: 'a' | 'b'; nonce?: string }
  | { type: 'dispatch_render'; jobId: string }
  | { type: 'notify_rendered'; jobId: string };

interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  JOBS: Queue<QueueTask>;
  AI: Ai;
  GITHUB_OWNER: string;
  GITHUB_REPO: string;
  GITHUB_BRANCH: string;
  ALLOWED_CHAT_ID: string;
  FREE_ONLY_MODE?: string;
  TEXT_MODEL: string;
  TEXT_FALLBACK_MODEL?: string;
  TEXT_PROVIDER?: string;
  HORDE_BASE_URL?: string;
  HORDE_API_KEY?: string;
  HORDE_TEXT_MODELS?: string;
  HORDE_IMAGE_MODELS?: string;
  HORDE_TIMEOUT_SECONDS?: string;
  HORDE_IMAGE_TIMEOUT_SECONDS?: string;
  HORDE_IMAGE_STEPS?: string;
  POLLINATIONS_BASE_URL?: string;
  POLLINATIONS_API_KEY?: string;
  POLLINATIONS_IMAGE_MODEL?: string;
  OPENVERSE_BASE_URL?: string;
  IMAGE_MODEL: string;
  IMAGE_FALLBACK_MODEL?: string;
  IMAGE_FALLBACK_PROVIDER?: string;
  IMAGE_PROVIDER?: string;
  VISION_MODEL: string;
  VISION_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_VISION_MODEL?: string;
  VISION_QA_MODE: string;
  IMAGE_WIDTH: string;
  IMAGE_HEIGHT: string;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  GITHUB_TOKEN: string;
  CALLBACK_HMAC_SECRET: string;
  SETUP_TOKEN: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number };
  text?: string;
  document?: { file_id: string; file_name?: string; mime_type?: string; file_size?: number };
  photo?: Array<{ file_id: string; file_size?: number; width: number; height: number }>;
  reply_to_message?: { message_id: number };
}
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: TelegramMessage;
  };
}
interface JobRow {
  id: string;
  chat_id: string;
  source_path: string;
  source_key: string | null;
  report_title: string | null;
  report_category: string | null;
  status: JobStatus;
  copy_version: number;
  page_count: number;
  render_manifest_key: string | null;
  final_pptx_key: string | null;
  final_zip_key: string | null;
  pptx_sent: number;
  zip_sent: number;
  final_notice_sent: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}
interface PageRow {
  job_id: string;
  page_no: number;
  page_kind: 'cover' | 'body' | 'cta';
  title: string;
  body: string;
  visual_style: 'photo' | 'illustration';
  visual_brief_ko: string;
  visual_prompt: string;
  image_required: number;
  reuse_page_no: number | null;
  image_a_key: string | null;
  image_b_key: string | null;
  selected_key: string | null;
  qa_a_json: string | null;
  qa_b_json: string | null;
  status: string;
}
interface CallbackPayload {
  event_id: string;
  job_id: string;
  stage: 'SOURCE_PARSED' | 'RENDERED' | 'FAILED';
  source_key?: string;
  pptx_key?: string;
  zip_key?: string;
  error?: string;
}
interface ReportPublishedPayload { event_id: string; source_path: string }
interface AiDraft {
  report_title: string;
  category: 'insights' | 'issues' | 'sectors';
  cover: {
    title: string;
    subtitle: string;
    visual_style: 'photo' | 'illustration';
    visual_brief_ko: string;
    visual_prompt: string;
  };
  body_pages: Array<{
    title: string;
    body: string;
    visual_style: 'photo' | 'illustration';
    visual_brief_ko: string;
    visual_prompt: string;
  }>;
  cta_subject: string;
}
interface AiCopyDraft {
  report_title: string;
  category: 'insights' | 'issues' | 'sectors';
  cover: { title: string; subtitle: string };
  body_pages: Array<{ title: string; body: string }>;
  cta_subject: string;
}
interface GitHubContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  download_url: string | null;
}
interface ReportChoice {
  name: string;
  path: string;
  title: string;
  date: string;
  category: string;
}
interface InlineButton { text: string; callback_data: string }

const CTA_SUFFIX = '에 대한\n더 자세한 이야기와, 다른 다양한 주제에 대한 리포트는\nSRC_Plus 페이지( https://srcplus.vercel.app/ )에서\n무료로 만나보실 수 있습니다.';
const IMAGE_POLICY_PHOTO = [
  'Premium Getty Images-style editorial photography for a serious Korean real-estate, infrastructure and finance publication.',
  'Translate the page claim into a specific asset, facility, workplace action or documentary scene; the image must not be a generic interchangeable business stock photo.',
  'Photorealistic materials, physically plausible architecture, natural perspective, restrained contrast, low saturation and believable natural or workplace light.',
  'Unposed documentary composition with one clear focal point, vertical 3:4 full bleed.',
  'People are optional and never the subject. Three or more people may appear small within a wider indoor or outdoor space. One or two people are also acceptable when shown from behind, in profile at a distance, as small silhouettes or as distant workers, with no identifiable face; the facility, landscape or work setting must remain the focal point. Never use a face close-up, headshot or face-led composition.',
  'Keep the lower 30 to 40 percent visually calm and slightly darker for a text overlay, integrated naturally into the scene rather than as a large empty black floor or blank slab.',
  'No readable text, letters, numbers, captions, labels, company logos, trademarks, brand marks, signage, product labels or watermarks.',
  'No recognizable company-specific storefront or corporate identity.',
  'No generic handshake, meaningless boardroom, decorative laptop, neon hologram, puzzle, scale, lightbulb or coin-pile cliché unless it is essential to the stated scene.',
  'No impossible geometry, duplicated structures, glossy plastic render, extreme HDR, neon glow, game concept art or cinematic fog.',
  'No sketch, drawing, illustration, anime, animation still, cartoon, painting, watercolor, vector art, CGI or 3D render.',
].join(' ');
const IMAGE_POLICY_ILLUSTRATION = [
  'Photographic editorial composite that could plausibly appear in a premium economics magazine, not a flat illustration or infographic.',
  'Use a restrained visual metaphor only when a real documentary scene cannot explain the page claim. Preserve realistic materials, scale, perspective and light.',
  'Muted sophisticated colors, one immediately understandable focal metaphor, vertical 3:4 full bleed.',
  'People are optional and never the subject. Three or more people may appear small within a wider space. One or two people are acceptable only as distant rear views, side views or small silhouettes with no identifiable face; never use a face close-up, headshot or face-led composition.',
  'Keep the lower 30 to 40 percent calm and slightly darker for a text overlay, integrated naturally into the photographed environment.',
  'No text, letters, numbers, captions, company logos, trademarks, signage or watermarks.',
  'No glossy plastic 3D render, cartoon, game concept art, neon gradients, decorative symbols or corporate brand identity.',
  'No sketch, drawing, anime, animation still, painting, watercolor or vector-art treatment; the result must remain convincingly photographic.',
].join(' ');

function now(): string { return new Date().toISOString(); }
function isAiQuotaError(message: string): boolean {
  return /daily free allocation|free allocation of 10,000 neurons|무료 할당량|4006|3036|insufficient_quota|billing_hard_limit|rate limit|429/i.test(message);
}
function nextAiQuotaResetLabel(): string {
  const current = new Date();
  const reset = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1, 0, 0, 0));
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(reset);
}
function userFacingAiError(message: string): string {
  if (!isAiQuotaError(message)) return message;
  if (/daily free allocation|free allocation of 10,000 neurons|무료 할당량|4006|3036/i.test(message)) {
    return `Cloudflare Workers AI 무료 할당량(하루 10,000 Neurons)을 모두 사용했다는 작업 당시의 기록입니다. 무료 사용량은 매일 00:00 UTC, 한국시간 오전 9시에 초기화됩니다. 다음 초기화 시각: ${nextAiQuotaResetLabel()} (한국시간). 현재 할당량을 다시 확인하려면 초기화 후 /retry를 실행하세요. 작업은 보존되어 있습니다.`;
  }
  return `외부 AI provider의 사용량 또는 요청 한도에 도달했습니다. 작업은 보존되어 있으며, provider 한도가 회복된 뒤 /retry로 다시 실행할 수 있습니다. 원문과 승인된 문안은 유지됩니다.`;
}
function freeOnlyMode(env: Env): boolean { return (env.FREE_ONLY_MODE?.trim().toLowerCase() || 'true') !== 'false'; }
function aiProvider(env: Env, kind: 'text' | 'image' | 'vision'): 'cloudflare' | 'openai' | 'horde' | 'pollinations' | 'openverse' | 'off' {
  const configured = (kind === 'text' ? env.TEXT_PROVIDER : kind === 'image' ? env.IMAGE_PROVIDER : env.VISION_PROVIDER)?.trim().toLowerCase();
  if (freeOnlyMode(env) && (configured === 'openai' || configured === 'cloudflare')) throw new Error(`FREE_ONLY_MODE에서는 ${configured} provider를 호출할 수 없습니다.`);
  if (configured === 'cloudflare' || configured === 'openai' || configured === 'horde' || configured === 'pollinations' || configured === 'openverse' || configured === 'off') return configured;
  if (freeOnlyMode(env)) return kind === 'vision' ? 'off' : 'horde';
  return env.OPENAI_API_KEY?.trim() ? 'openai' : 'cloudflare';
}
function openAiBaseUrl(env: Env): string { return (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/$/, ''); }
function hordeBaseUrl(env: Env): string { return (env.HORDE_BASE_URL?.trim() || 'https://stablehorde.net/api').replace(/\/$/, ''); }
function hordeApiKey(env: Env): string { return env.HORDE_API_KEY?.trim() || '0000000000'; }
function hordeModels(env: Env): string[] {
  return (env.HORDE_TEXT_MODELS?.trim() || 'google/gemma-4-31b,koboldcpp/L3-Super-Nova-RP-8B').split(',').map((model) => model.trim()).filter(Boolean);
}
function hordeImageModels(env: Env): string[] {
  return (env.HORDE_IMAGE_MODELS?.trim() || 'ICBINP - I Can\'t Believe It\'s Not Photography,Realistic Vision,Flux.1-Schnell fp8 (Compact),stable_diffusion').split(',').map((model) => model.trim()).filter(Boolean);
}
function hordePrompt(input: Record<string, unknown>): string {
  const messages = Array.isArray(input.messages) ? input.messages as Array<Record<string, unknown>> : [];
  return `${messages.map((message) => `${String(message.role ?? 'user').toUpperCase()}: ${typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '')}`).join('\n\n')}\n\nASSISTANT: JSON 객체만 반환한다. 마크다운 코드펜스와 설명을 붙이지 않는다.`;
}
async function runHordeText(env: Env, input: Record<string, unknown>): Promise<{ response: Record<string, unknown> }> {
  const headers = { apikey: hordeApiKey(env), 'client-agent': 'SRCPlus:free-pipeline/1.0', 'content-type': 'application/json' };
  const maxLength = Math.min(Math.max(Number(input.max_tokens ?? 2048), 256), 4096);
  const submit = await fetch(`${hordeBaseUrl(env)}/v2/generate/text/async`, {
    method: 'POST', headers,
    body: JSON.stringify({ prompt: hordePrompt(input), params: { max_length: maxLength, temperature: Number(input.temperature ?? 0.2), top_p: 0.9 }, models: hordeModels(env), trusted_workers: true }),
  });
  const queued = await submit.json() as { id?: string; message?: string; errors?: unknown };
  if (!submit.ok || !queued.id) throw new Error(`AI Horde text ${submit.status}: ${queued.message ?? JSON.stringify(queued.errors ?? '')}`);
  const timeout = Math.min(Math.max(Number(env.HORDE_TIMEOUT_SECONDS ?? 75), 15), 180);
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const status = await fetch(`${hordeBaseUrl(env)}/v2/generate/text/status/${encodeURIComponent(queued.id)}`, { headers: { apikey: hordeApiKey(env), 'client-agent': 'SRCPlus:free-pipeline/1.0' } });
    const result = await status.json() as { done?: boolean; faulted?: boolean; generations?: Array<{ text?: string }> };
    if (result.faulted) throw new Error('AI Horde text generation failed.');
    if (result.done && result.generations?.[0]?.text) return { response: parseJsonContent(result.generations[0].text) };
  }
  throw new Error('AI Horde text generation timed out.');
}
async function runHordeImage(env: Env, input: Record<string, unknown>): Promise<{ image: string; contentType: string }> {
  const headers = { apikey: hordeApiKey(env), 'client-agent': 'SRCPlus:free-pipeline/1.0', 'content-type': 'application/json' };
  const width = Math.min(Math.max(Math.floor(Number(input.width ?? 512) / 64) * 64, 256), 512);
  const height = Math.min(Math.max(Math.floor(Number(input.height ?? 704) / 64) * 64, 256), 704);
  const steps = Math.min(Math.max(Number(env.HORDE_IMAGE_STEPS ?? 8), 4), 12);
  const prompt = `RAW editorial photograph, photorealistic documentary image for a serious economics magazine. Natural lens perspective, believable materials and light, no illustration, no CGI, no 3D render, no text, no logo, no watermark. ${String(input.prompt ?? '')}`;
  const submit = await fetch(`${hordeBaseUrl(env)}/v2/generate/async`, {
    method: 'POST', headers,
    body: JSON.stringify({
      prompt,
      params: { width, height, steps, n: 1, sampler_name: 'k_euler', cfg_scale: 4 },
      models: hordeImageModels(env), nsfw: false, trusted_workers: true,
    }),
  });
  const queued = await submit.json() as { id?: string; message?: string; errors?: unknown; kudos?: number };
  if (!submit.ok || !queued.id) throw new Error(`AI Horde image ${submit.status}: ${queued.message ?? JSON.stringify(queued.errors ?? '')}`);
  const timeout = Math.min(Math.max(Number(env.HORDE_IMAGE_TIMEOUT_SECONDS ?? 150), 30), 300);
  const deadline = Date.now() + timeout * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const status = await fetch(`${hordeBaseUrl(env)}/v2/generate/status/${encodeURIComponent(queued.id)}`, { headers: { apikey: hordeApiKey(env), 'client-agent': 'SRCPlus:free-pipeline/1.0' } });
    const result = await status.json() as { done?: boolean; faulted?: boolean; generations?: Array<{ img?: string; censored?: boolean }> };
    if (result.faulted) throw new Error('AI Horde image generation failed.');
    const generation = result.generations?.[0];
    if (result.done && generation?.img && !generation.censored) {
      const image = await fetch(generation.img, { headers: { 'user-agent': 'SRCPlus-free-pipeline/1.0' } });
      if (!image.ok) throw new Error(`AI Horde image download ${image.status}`);
      return { image: bytesToBase64(new Uint8Array(await image.arrayBuffer())), contentType: image.headers.get('content-type') ?? 'image/png' };
    }
  }
  throw new Error('AI Horde image generation timed out.');
}
function pollinationsBaseUrl(env: Env): string { return (env.POLLINATIONS_BASE_URL?.trim() || 'https://image.pollinations.ai').replace(/\/$/, ''); }
async function runPollinationsImage(env: Env, input: Record<string, unknown>): Promise<{ image: string; contentType: string }> {
  const prompt = String(input.prompt ?? '');
  if (!prompt) throw new Error('Pollinations 이미지 프롬프트가 비어 있습니다.');
  const width = Math.min(Math.max(Math.floor(Number(input.width ?? 512) / 64) * 64, 256), 512);
  const height = Math.min(Math.max(Math.floor(Number(input.height ?? 704) / 64) * 64, 256), 704);
  const model = encodeURIComponent(env.POLLINATIONS_IMAGE_MODEL?.trim() || 'flux');
  const apiKey = freeOnlyMode(env) ? '' : env.POLLINATIONS_API_KEY?.trim() || '';
  const endpoint = apiKey
    ? `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`
    : `${pollinationsBaseUrl(env)}/prompt/${encodeURIComponent(prompt)}`;
  const url = `${endpoint}?model=${model}&width=${width}&height=${height}&nologo=true&enhance=false&safe=true`;
  const headers: Record<string, string> = { accept: 'image/jpeg,image/png,image/webp', 'user-agent': 'SRCPlus-free-pipeline/1.0' };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Pollinations image ${response.status}`);
  return { image: bytesToBase64(new Uint8Array(await response.arrayBuffer())), contentType: response.headers.get('content-type') ?? 'image/jpeg' };
}
function openverseBaseUrl(env: Env): string { return (env.OPENVERSE_BASE_URL?.trim() || 'https://api.openverse.org/v1').replace(/\/$/, ''); }
function stockSearchQuery(prompt: string): string {
  const subject = prompt.split(/subject and scene:\s*/i)[1] ?? prompt;
  return subject.replace(/\b(?:no|without|avoid|never|not|keep|use|make|ensure|include|featuring|vertical|editorial|photograph|photo|photographic|realistic|premium|Getty Images|3:4|full bleed)\b[^,.]*[,.;]?/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
}
async function runOpenverseImage(env: Env, input: Record<string, unknown>): Promise<{ image: string; contentType: string; source?: Record<string, string> }> {
  const query = stockSearchQuery(String(input.prompt ?? ''));
  if (!query) throw new Error('Openverse 검색어를 만들지 못했습니다.');
  const url = `${openverseBaseUrl(env)}/images/?q=${encodeURIComponent(query)}&page_size=20&license_type=commercial&filter_dead=true`;
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'SRCPlus-free-pipeline/1.0' } });
  if (!response.ok) throw new Error(`Openverse search ${response.status}`);
  const payload = await response.json() as { results?: Array<{ url?: string; thumbnail?: string; title?: string; creator?: string; license?: string; license_url?: string; foreign_landing_url?: string; width?: number; height?: number; attribution?: string }> };
  const candidates = (payload.results ?? []).filter((item) => item.url || item.thumbnail).sort((a, b) => {
    const aRatio = Number(a.width ?? 0) / Math.max(Number(a.height ?? 1), 1);
    const bRatio = Number(b.width ?? 0) / Math.max(Number(b.height ?? 1), 1);
    return Math.abs(aRatio - 0.75) - Math.abs(bRatio - 0.75);
  });
  for (const candidate of candidates.slice(0, 8)) {
    for (const imageUrl of [candidate.url, candidate.thumbnail].filter(Boolean) as string[]) {
      try {
        const image = await fetch(imageUrl, { headers: { 'user-agent': 'SRCPlus-free-pipeline/1.0' } });
        if (!image.ok) continue;
        const bytes = new Uint8Array(await image.arrayBuffer());
        if (bytes.length < 10000) continue;
        return { image: bytesToBase64(bytes), contentType: image.headers.get('content-type') ?? 'image/jpeg', source: { url: imageUrl, landing_url: candidate.foreign_landing_url ?? imageUrl, title: candidate.title ?? '', creator: candidate.creator ?? '', license: candidate.license ?? '', license_url: candidate.license_url ?? '', attribution: candidate.attribution ?? '' } };
      } catch { /* try the next candidate */ }
    }
  }
  throw new Error('Openverse에서 조건에 맞는 이미지를 찾지 못했습니다.');
}
function parseJsonContent(value: unknown): Record<string, unknown> {
  const text = typeof value === 'string' ? value.trim() : JSON.stringify(value ?? '');
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch { /* continue with the first JSON object */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  throw new Error('OpenAI가 유효한 JSON 응답을 반환하지 않았습니다.');
}
async function runOpenAiChat(env: Env, input: Record<string, unknown>, model: string): Promise<{ response: Record<string, unknown> }> {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('OpenAI provider가 선택됐지만 OPENAI_API_KEY가 설정되지 않았습니다.');
  const rawMessages = Array.isArray(input.messages) ? input.messages as Array<Record<string, unknown>> : [];
  const image = typeof input.image === 'string' ? input.image : null;
  const lastUser = rawMessages.map((message, index) => {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '');
    if (!image || index !== rawMessages.length - 1 || message.role !== 'user') return { role: message.role, content };
    return { role: message.role, content: [{ type: 'text', text: content }, { type: 'image_url', image_url: { url: image } }] };
  });
  const responseFormat = input.response_format ? { type: 'json_object' } : undefined;
  const responseSchema = input.response_format ? `\n반드시 JSON 객체만 반환한다. 참고할 출력 스키마: ${JSON.stringify(input.response_format)}` : '';
  if (responseSchema && lastUser.length && lastUser[0].role === 'system') lastUser[0] = { ...lastUser[0], content: `${lastUser[0].content}${responseSchema}` };
  const response = await fetch(`${openAiBaseUrl(env)}/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model, messages: lastUser, temperature: input.temperature, max_tokens: input.max_tokens, response_format: responseFormat }),
  });
  const payload = await response.json() as { error?: { message?: string; code?: string }; choices?: Array<{ message?: { content?: unknown } }> };
  if (!response.ok) throw new Error(`OpenAI ${response.status} ${payload.error?.code ?? ''} ${payload.error?.message ?? ''}`.trim());
  const content = payload.choices?.[0]?.message?.content;
  if (content === undefined) throw new Error('OpenAI가 응답 본문을 반환하지 않았습니다.');
  return { response: parseJsonContent(content) };
}
async function runTextModel(env: Env, input: Record<string, unknown>): Promise<unknown> {
  if (aiProvider(env, 'text') === 'openai') return runOpenAiChat(env, input, env.OPENAI_TEXT_MODEL?.trim() || 'gpt-4o-mini');
  if (aiProvider(env, 'text') === 'horde') return runHordeText(env, input);
  try {
    return await env.AI.run(env.TEXT_MODEL, input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const fallback = env.TEXT_FALLBACK_MODEL?.trim();
    if (!fallback || fallback === env.TEXT_MODEL || isAiQuotaError(reason)) throw error;
    return env.AI.run(fallback, input);
  }
}
async function runImageModel(env: Env, input: Record<string, unknown>): Promise<unknown> {
  if (aiProvider(env, 'image') === 'horde') return runHordeImage(env, input);
  if (aiProvider(env, 'image') === 'pollinations') {
    try {
      return await runPollinationsImage(env, input);
    } catch (error) {
      if (env.IMAGE_FALLBACK_PROVIDER?.trim().toLowerCase() === 'horde') return runHordeImage(env, input);
      throw error;
    }
  }
  if (aiProvider(env, 'image') === 'openverse') return runOpenverseImage(env, input);
  if (aiProvider(env, 'image') === 'openai') {
    const apiKey = env.OPENAI_API_KEY?.trim();
    if (!apiKey) throw new Error('OpenAI provider가 선택됐지만 OPENAI_API_KEY가 설정되지 않았습니다.');
    const width = Number(input.width ?? 960);
    const height = Number(input.height ?? 1280);
    const response = await fetch(`${openAiBaseUrl(env)}/images/generations`, {
      method: 'POST', headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: env.OPENAI_IMAGE_MODEL?.trim() || 'gpt-image-1', prompt: input.prompt, size: width >= height ? '1536x1024' : '1024x1536', quality: 'medium', output_format: 'png' }),
    });
    const payload = await response.json() as { error?: { message?: string; code?: string }; data?: Array<{ b64_json?: string }> };
    if (!response.ok) throw new Error(`OpenAI ${response.status} ${payload.error?.code ?? ''} ${payload.error?.message ?? ''}`.trim());
    const image = payload.data?.[0]?.b64_json;
    if (!image) throw new Error('OpenAI 이미지 모델이 이미지를 반환하지 않았습니다.');
    return { image };
  }
  const runCloudflareImage = (model: string) => {
    const form = new FormData();
    form.append('prompt', String(input.prompt ?? ''));
    form.append('width', String(input.width ?? env.IMAGE_WIDTH ?? '960'));
    form.append('height', String(input.height ?? env.IMAGE_HEIGHT ?? '1280'));
    form.append('guidance', '4');
    form.append('seed', String(input.seed ?? 0));
    const serialized = new Response(form);
    return env.AI.run(model, { multipart: { body: serialized.body, contentType: serialized.headers.get('content-type') } });
  };
  try {
    return await runCloudflareImage(env.IMAGE_MODEL);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const fallback = env.IMAGE_FALLBACK_MODEL?.trim();
    if (!fallback || fallback === env.IMAGE_MODEL || isAiQuotaError(reason)) throw error;
    return runCloudflareImage(fallback);
  }
}
async function runVisionModel(env: Env, input: Record<string, unknown>): Promise<unknown> {
  if (aiProvider(env, 'vision') === 'off') return { response: { mode: 'off' } };
  if (aiProvider(env, 'vision') === 'openai') return runOpenAiChat(env, input, env.OPENAI_VISION_MODEL?.trim() || env.OPENAI_TEXT_MODEL?.trim() || 'gpt-4o-mini');
  if (aiProvider(env, 'vision') === 'horde' || aiProvider(env, 'vision') === 'pollinations' || aiProvider(env, 'vision') === 'openverse') return { response: { mode: 'advisory', note: '무료 모드에서는 자동 비전 QA를 생략하고 Telegram 사람 검수를 사용합니다.' } };
  return env.AI.run(env.VISION_MODEL, input);
}
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}
function shortId(length = 12): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
function clamp(value: string, max: number): string { return value.length <= max ? value : `${value.slice(0, max - 1).trim()}…`; }
function fileName(path: string): string { return path.split('/').pop() ?? path; }
function splitTelegram(text: string, limit = 3800): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let at = rest.lastIndexOf('\n', limit);
    if (at < limit * 0.55) at = limit;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).replace(/^\n+/, '');
  }
  if (rest) out.push(rest);
  return out;
}
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/^data:[^,]+,/, ''));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function hmacHex(secret: string, body: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, Uint8Array.from(body));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}
async function verifyHmac(secret: string, body: Uint8Array, header: string | null): Promise<boolean> {
  if (!header?.startsWith('sha256=')) return false;
  return (await hmacHex(secret, body)) === header.slice(7).toLowerCase();
}
function seedFor(jobId: string, pageNo: number, variant: string, nonce = ''): number {
  let hash = 2166136261;
  for (const ch of `${jobId}:${pageNo}:${variant}:${nonce}`) { hash ^= ch.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return Math.abs(hash >>> 0) % 999999999 + 1;
}

async function telegramCall<T>(env: Env, method: string, body: BodyInit, headers?: HeadersInit): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', body, headers });
  const payload = await response.json() as { ok: boolean; result: T; description?: string };
  if (!payload.ok) throw new Error(`Telegram ${method}: ${payload.description ?? response.status}`);
  return payload.result;
}
async function sendMessage(env: Env, chatId: string, text: string, buttons?: InlineButton[][], forceReply = false): Promise<{ message_id: number }> {
  const payload: Record<string, unknown> = { chat_id: chatId, text, disable_web_page_preview: true };
  if (buttons) payload.reply_markup = { inline_keyboard: buttons };
  else if (forceReply) payload.reply_markup = { force_reply: true, selective: true, input_field_placeholder: '수정할 내용을 입력하세요' };
  return telegramCall(env, 'sendMessage', JSON.stringify(payload), { 'content-type': 'application/json' });
}
async function sendLongMessage(env: Env, chatId: string, text: string): Promise<void> {
  for (const chunk of splitTelegram(text)) await sendMessage(env, chatId, chunk);
}
async function progress(env: Env, job: JobRow, status: JobStatus, message: string): Promise<void> {
  await updateJob(env, job.id, { status, last_error: null });
  await sendMessage(env, job.chat_id, `${message}\n작업: ${job.id}`);
}
async function sendPhoto(env: Env, chatId: string, bytes: Uint8Array, caption: string): Promise<void> {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('photo', new Blob([Uint8Array.from(bytes)], { type: 'image/png' }), 'image.png');
  form.append('caption', clamp(caption, 1000));
  await telegramCall(env, 'sendPhoto', form);
}
async function sendDocument(env: Env, chatId: string, bytes: Uint8Array, name: string, caption: string): Promise<void> {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append('document', new Blob([Uint8Array.from(bytes)]), name);
  form.append('caption', caption);
  await telegramCall(env, 'sendDocument', form);
}
async function downloadTelegramFile(env: Env, fileId: string): Promise<{ bytes: Uint8Array; path: string }> {
  const file = await telegramCall<{ file_path?: string }>(env, 'getFile', JSON.stringify({ file_id: fileId }), { 'content-type': 'application/json' });
  if (!file.file_path) throw new Error('Telegram 파일 경로를 찾지 못했습니다.');
  const response = await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${file.file_path}`);
  if (!response.ok) throw new Error(`Telegram 파일 다운로드 실패: ${response.status}`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), path: file.file_path };
}
async function answerCallback(env: Env, id: string, text = '처리 중'): Promise<void> {
  await telegramCall(env, 'answerCallbackQuery', JSON.stringify({ callback_query_id: id, text }), { 'content-type': 'application/json' });
}
async function registerReply(env: Env, chatId: string, jobId: string, purpose: string, text: string): Promise<void> {
  const message = await sendMessage(env, chatId, text, undefined, true);
  await env.DB.prepare('INSERT OR REPLACE INTO telegram_prompts(chat_id,message_id,job_id,purpose) VALUES(?,?,?,?)')
    .bind(chatId, message.message_id, jobId, purpose).run();
}
async function registerAttachmentRequest(env: Env, chatId: string, jobId: string, purpose: string, text: string, pageNo?: number): Promise<void> {
  const message = await sendMessage(env, chatId, text);
  await env.DB.prepare('INSERT OR REPLACE INTO telegram_prompts(chat_id,message_id,job_id,purpose,page_no) VALUES(?,?,?,?,?)')
    .bind(chatId, message.message_id, jobId, purpose, pageNo ?? null).run();
}

async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first<{ value: string }>();
  return row?.value ?? null;
}
async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(`INSERT INTO settings(key,value,updated_at) VALUES(?,?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`).bind(key, value, now()).run();
}
async function allowedChatId(env: Env): Promise<string | null> {
  return env.ALLOWED_CHAT_ID?.trim() || await getSetting(env, 'admin_chat_id');
}
async function requireAllowed(env: Env, chatId: string): Promise<boolean> {
  const allowed = await allowedChatId(env);
  if (allowed === chatId) return true;
  await sendMessage(env, chatId, allowed ? '이 봇을 사용할 권한이 없습니다.' : '아직 관리자가 등록되지 않았습니다. /claim 설정토큰 을 입력하세요.');
  return false;
}
async function getJob(env: Env, id: string): Promise<JobRow | null> {
  return env.DB.prepare('SELECT * FROM jobs WHERE id = ?').bind(id).first<JobRow>();
}
async function getPages(env: Env, id: string): Promise<PageRow[]> {
  const result = await env.DB.prepare('SELECT * FROM pages WHERE job_id = ? ORDER BY page_no').bind(id).all<PageRow>();
  return result.results;
}
async function updateJob(env: Env, id: string, fields: Record<string, string | number | null>): Promise<void> {
  const entries = Object.entries({ ...fields, updated_at: now() });
  await env.DB.prepare(`UPDATE jobs SET ${entries.map(([key]) => `${key} = ?`).join(', ')} WHERE id = ?`)
    .bind(...entries.map(([, value]) => value), id).run();
}
async function recordEvent(env: Env, key: string, type: string, payload: unknown, jobId?: string): Promise<boolean> {
  const result = await env.DB.prepare('INSERT OR IGNORE INTO events(job_id,idempotency_key,event_type,payload) VALUES(?,?,?,?)')
    .bind(jobId ?? null, key, type, JSON.stringify(payload)).run();
  return (result.meta.changes ?? 0) > 0;
}
async function markFailure(env: Env, id: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await updateJob(env, id, { status: 'FAILED_RETRYABLE', last_error: clamp(message, 1500) });
}

function githubHeaders(env: Env): HeadersInit {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    'x-github-api-version': '2022-11-28',
    'user-agent': 'srcplus-cardnews-worker',
  };
}
async function githubJson<T>(env: Env, url: string): Promise<T> {
  const response = await fetch(url, { headers: githubHeaders(env) });
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}
function parseReportMeta(html: string): { title?: string; cat?: string; date?: string; published?: boolean } | null {
  const match = html.match(/<script[^>]+id=["']report-meta["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1].trim()) as { title?: string; cat?: string; date?: string; published?: boolean }; }
  catch { return null; }
}
async function fetchGithubFileText(env: Env, path: string): Promise<string> {
  const url = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  const data = await githubJson<{ content: string; encoding: string }>(env, url);
  if (data.encoding !== 'base64') throw new Error(`Unsupported GitHub encoding for ${path}`);
  return new TextDecoder().decode(base64ToBytes(data.content.replace(/\s/g, '')));
}
async function listReports(env: Env): Promise<ReportChoice[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/contents?ref=${encodeURIComponent(env.GITHUB_BRANCH)}`;
  const items = await githubJson<GitHubContentItem[]>(env, url);
  const candidates = items.filter((item) => item.type === 'file' && /^reports_.*\.html$/i.test(item.name) && !/_PREVIEW/i.test(item.name));
  const reports: ReportChoice[] = [];
  for (const item of candidates.slice(0, 30)) {
    const meta = parseReportMeta(await fetchGithubFileText(env, item.path));
    if (!meta?.published) continue;
    reports.push({ name: item.name, path: item.path, title: meta.title || item.name, date: meta.date || '', category: meta.cat || '' });
  }
  return reports.sort((a, b) => b.date.localeCompare(a.date) || b.name.localeCompare(a.name));
}
async function dispatchGithub(env: Env, action: 'parse' | 'render', jobId: string, sourcePath: string): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}/dispatches`, {
    method: 'POST',
    headers: { ...githubHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({ event_type: 'cardnews_job', client_payload: { action, job_id: jobId, source_path: sourcePath } }),
  });
  if (response.status !== 204) throw new Error(`GitHub dispatch ${response.status}: ${await response.text()}`);
}

async function sendChatGptPackage(env: Env, job: JobRow): Promise<void> {
  const html = await fetchGithubFileText(env, job.source_path);
  const gptInstructions = await fetchGithubFileText(env, 'automation/cardnews/chatgpt/SRC_PLUS_GPT_INSTRUCTIONS.md');
  const handoff = `SRC Plus ChatGPT 작업 패킷\n\n1. ChatGPT에서 전용 SRC Plus GPT를 연다.\n2. 함께 전송된 HTML과 editorial.json을 업로드한다.\n3. GPT 지침에 따라 JSON만 출력하게 한다.\n4. JSON을 파일로 저장해 이 Telegram 채팅에 첨부한다.\n5. 봇이 문안·이미지 프롬프트를 검증한 뒤, 페이지별 최종 이미지를 한 장씩 요청한다.\n\n중요: JSON에는 표지 1장과 본문 4장, visual_style, visual_brief_ko, visual_prompt가 모두 포함돼야 한다. 이미지 프롬프트는 영어 110~150단어, 마지막 문장은 \"No readable text, numbers, logos, signage or watermark.\"여야 한다.`;
  await sendDocument(env, job.chat_id, new TextEncoder().encode(html), fileName(job.source_path), `ChatGPT에 업로드할 원본 HTML · ${job.id}`);
  await sendDocument(env, job.chat_id, new TextEncoder().encode(JSON.stringify(editorialRules, null, 2)), 'editorial.json', 'SRC Plus 중앙 문안·이미지 규칙');
  await sendDocument(env, job.chat_id, new TextEncoder().encode(gptInstructions), 'SRC_PLUS_GPT_INSTRUCTIONS.md', 'Custom GPT Instructions 또는 일반 ChatGPT 대화에 함께 업로드할 상세 지침');
  await sendDocument(env, job.chat_id, new TextEncoder().encode(handoff), 'SRC_PLUS_CHATGPT_HANDOFF.md', 'ChatGPT 작업 순서');
  await registerAttachmentRequest(env, job.chat_id, job.id, 'import_chatgpt_json', `ChatGPT에서 나온 최종 JSON 파일을 이 채팅에 첨부하세요.\n작업: ${job.id}`);
}

async function sendManualPromptReview(env: Env, job: JobRow): Promise<void> {
  const pages = (await getPages(env, job.id)).filter((page) => page.image_required);
  const summary = pages.map((page) => `${page.page_no}페이지 · ${page.title}\n${page.body}\n\n이미지: ${page.visual_brief_ko}`).join('\n\n');
  await sendLongMessage(env, job.chat_id, `ChatGPT JSON 검증을 통과했습니다.\n\n${summary}`);
  await sendMessage(env, job.chat_id, `ChatGPT에서 각 페이지의 이미지를 생성·검토한 뒤, 승인 이미지를 순서대로 보내세요.`, [
    [{ text: '이미지 업로드 시작', callback_data: `mu:${job.id}` }],
    [{ text: 'ChatGPT에서 수정 후 JSON 재업로드', callback_data: `me:${job.id}` }],
    [{ text: '작업 취소', callback_data: `cx:${job.id}` }],
  ]);
}

async function requestNextManualImage(env: Env, job: JobRow): Promise<void> {
  const page = (await getPages(env, job.id)).find((item) => item.image_required && !item.selected_key);
  if (!page) {
    await updateJob(env, job.id, { status: 'IMAGES_GENERATED' });
    await sendMessage(env, job.chat_id, `모든 승인 이미지를 받았습니다. PPTX와 PNG를 생성합니다.\n작업: ${job.id}`);
    await maybeRender(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  await registerAttachmentRequest(env, job.chat_id, job.id, 'upload_manual_image', `${page.page_no}페이지 승인 이미지를 원본 파일 또는 사진으로 하나 보내세요.\n제목: ${page.title}\n\nChatGPT 이미지 프롬프트:\n${page.visual_prompt}`, page.page_no);
}

async function storeManualImage(env: Env, job: JobRow, page: PageRow, bytes: Uint8Array, sourcePath: string): Promise<void> {
  if (bytes.byteLength < 10_000) throw new Error('이미지 파일이 너무 작습니다. 원본 이미지를 다시 보내세요.');
  const extension = /\.png$/i.test(sourcePath) ? 'png' : /\.webp$/i.test(sourcePath) ? 'webp' : 'jpg';
  const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
  const key = `jobs/${job.id}/images/page-${String(page.page_no).padStart(2, '0')}-manual.${extension}`;
  await env.ASSETS.put(key, bytes, { httpMetadata: { contentType } });
  await env.DB.prepare("UPDATE pages SET image_a_key=?,selected_key=?,qa_a_json=?,status='IMAGE_SELECTED',updated_at=? WHERE job_id=? AND page_no=?")
    .bind(key, key, JSON.stringify({ mode: 'manual_chatgpt_reviewed' }), now(), job.id, page.page_no).run();
}

function draftSchema(): Record<string, unknown> {
  const { limits } = editorialRules;
  const visualProperties = {
    visual_style: { type: 'string', enum: ['photo', 'illustration'] },
    visual_brief_ko: { type: 'string', minLength: 10 },
    visual_prompt: { type: 'string', minLength: 20 },
  };
  return {
    type: 'object',
    properties: {
      report_title: { type: 'string' },
      category: { type: 'string', enum: ['insights', 'issues', 'sectors'] },
      cover: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: limits.cover_title_max_chars },
          subtitle: { type: 'string', minLength: limits.cover_subtitle_min_chars, maxLength: limits.cover_subtitle_max_chars },
          ...visualProperties,
        },
        required: ['title', 'subtitle', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
      },
      body_pages: {
        type: 'array', minItems: editorialRules.structure.body_pages_min, maxItems: editorialRules.structure.body_pages_max,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: limits.body_title_min_chars, maxLength: limits.body_title_max_chars },
            body: { type: 'string', minLength: limits.body_min_chars, maxLength: limits.body_max_chars },
            ...visualProperties,
          },
          required: ['title', 'body', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
        },
      },
      cta_subject: { type: 'string', maxLength: limits.cta_subject_max_chars },
    },
    required: ['report_title', 'category', 'cover', 'body_pages', 'cta_subject'],
  };
}
function copyDraftSchema(bodyPageCount: number): Record<string, unknown> {
  const { limits } = editorialRules;
  return {
    type: 'object',
    properties: {
      report_title: { type: 'string' },
      category: { type: 'string', enum: ['insights', 'issues', 'sectors'] },
      cover: {
        type: 'object',
        properties: {
          title: { type: 'string', maxLength: limits.cover_title_max_chars },
          subtitle: { type: 'string', minLength: limits.cover_subtitle_min_chars, maxLength: limits.cover_subtitle_max_chars },
        },
        required: ['title', 'subtitle'],
      },
      body_pages: {
        type: 'array', minItems: bodyPageCount, maxItems: bodyPageCount,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: limits.body_title_min_chars, maxLength: limits.body_title_max_chars },
            body: { type: 'string', minLength: limits.body_min_chars, maxLength: limits.body_max_chars },
          },
          required: ['title', 'body'],
        },
      },
      cta_subject: { type: 'string', maxLength: limits.cta_subject_max_chars },
    },
    required: ['report_title', 'category', 'cover', 'body_pages', 'cta_subject'],
  };
}

function ensureKorean(value: string, field: string): string {
  const text = value.trim();
  if (!/[가-힣]/.test(text)) throw new Error(`${field}에 한국어가 없습니다.`);
  return text;
}
function validateVisualPrompt(value: string): string {
  const prompt = clamp(value.trim(), 1300);
  if (!prompt) throw new Error('빈 이미지 프롬프트가 생성됐습니다.');
  if (/[가-힣]/.test(prompt)) throw new Error('이미지 프롬프트에 한국어가 포함됐습니다. 다시 생성합니다.');
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount < 110 || wordCount > 150) throw new Error(`이미지 프롬프트는 110~150개 영어 단어여야 합니다. 현재 ${wordCount}개입니다.`);
  if (/split[- ]screen|infographic|collage|montage|series of|(?:three|four|multiple) (?:photos|images|scenes)|(?:^|\W)(?:chart|graph)(?:\W|$)|text overlay|question mark|red flag|weighing scale|balance scale|stack of (?:cash|money)|counting (?:cash|money)|sketch|drawing|(?:^|\W)illustration(?:\W|$)|anime|animation|cartoon|painting|watercolor|vector art|3d render|(?:^|\W)cgi(?:\W|$)|face[- ]led|headshot|portrait(?:\W|$)|face close[- ]up|close[- ]up portrait|close[- ]up of (?:a|one|an) (?:person|man|woman|investor|professional|worker)/i.test(prompt)) throw new Error('이미지 프롬프트에 다중 장면·그래프·일러스트·인물 얼굴 중심 구도가 포함됐습니다. 사람은 공간을 설명하는 보조 요소로만 사용하고 실제 촬영 장면으로 다시 생성합니다.');
  if (!/(?:camera|shoot|shot|view|angle|lens|depth of field)/i.test(prompt) || !/(?:light|lighting|daylight|dusk|dawn|overcast|sunset)/i.test(prompt)) throw new Error('이미지 프롬프트에 카메라 구도 또는 조명 지시가 빠졌습니다. 다시 생성합니다.');
  if (!/(?:no readable text|without readable text)/i.test(prompt) || !/(?:no readable text[^.]{0,60}\blogos?\b|without readable text[^.]{0,60}\blogos?\b|no (?:company )?logos?|without (?:company )?logos?)/i.test(prompt)) throw new Error('이미지 프롬프트에 글자와 로고 금지 지시가 빠졌습니다. 다시 생성합니다.');
  return prompt;
}
function comparable(value: string): string {
  return value.toLocaleLowerCase('ko-KR').replace(/[^0-9a-z가-힣]/g, '');
}
function assertDifferent(left: string, right: string, fields: string): void {
  if (comparable(left) === comparable(right)) throw new Error(`${fields}이(가) 서로 중복됐습니다. 다시 생성합니다.`);
}
function sentenceCount(value: string): number {
  return value.trim().match(/[.!?](?=(?:["'”’)\]]*\s)|$)/g)?.length ?? 0;
}
function sentences(value: string): string[] {
  return value.split(/(?<=[.!?])(?:["'”’)\]]*)\s+/).map(comparable).filter((part) => part.length >= 15);
}
function isPromotional(value: string): boolean {
  return /src[_ ]?plus|무료로|더 자세한 이야기|페이지에서/i.test(value);
}
function hasAiWritingCliche(value: string): boolean {
  const compact = value.replace(/\s+/g, ' ').trim();
  return /(?:아니다[.!?]\s*(?:진짜|정답|본질|핵심)은)|(?:(?<!뿐 )(?<!뿐)아니라\s+.{1,35}(?:이다|다)[.!?]?)|(?:핵심은)|(?:(?:중요한 것|중요한 점)(?:은|이)?\s*.{0,45}(?:라는 것이다|라는 점이다))|결국 우리가 주목해야 할 것은|단순히 .{1,35}(?:를|을) 넘어|이 질문에 대한 답은 명확하다|새로운 패러다임|게임\s*체인저|시장(?:의)? 열기|완충재|포트폴리오(?:의)? 온도|성장 엔진/i.test(compact);
}
function overlaps(left: string, right: string): boolean {
  return left.includes(right) || right.includes(left);
}
function sanitizeDraft(raw: AiDraft): AiDraft {
  const coverPhrases = [comparable(raw.cover.title), comparable(raw.cover.subtitle)].filter((value) => value.length >= 15);
  const seenSentences: string[] = [];
  const bodyPages = raw.body_pages.filter((page) => {
    if (isPromotional(page.body)) return false;
    const pageSentences = sentences(page.body);
    if (pageSentences.some((sentence) => coverPhrases.some((cover) => overlaps(sentence, cover)))) return false;
    if (pageSentences.some((sentence) => seenSentences.some((seen) => overlaps(sentence, seen)))) return false;
    seenSentences.push(...pageSentences);
    return true;
  });
  const safeBodyPages = bodyPages.length >= editorialRules.structure.body_pages_min ? bodyPages : raw.body_pages;
  const ctaSubject = /src[_ ]?plus|무료|만나보|리포트/i.test(raw.cta_subject) ? raw.cover.title : raw.cta_subject;
  return { ...raw, body_pages: safeBodyPages, cta_subject: ctaSubject };
}
function normalizeDraft(raw: AiDraft): AiDraft {
  const { limits, structure } = editorialRules;
  if (!raw?.cover || !Array.isArray(raw.body_pages) || raw.body_pages.length < structure.body_pages_min || raw.body_pages.length > structure.body_pages_max) throw new Error('AI 카드 구조가 유효하지 않습니다.');
  const cover = {
    title: clamp(ensureKorean(String(raw.cover.title ?? ''), '표지 제목'), limits.cover_title_max_chars),
    subtitle: clamp(ensureKorean(String(raw.cover.subtitle ?? ''), '표지 부제'), limits.cover_subtitle_max_chars),
    visual_style: raw.cover.visual_style === 'illustration' ? 'illustration' as const : 'photo' as const,
    visual_brief_ko: clamp(ensureKorean(String(raw.cover.visual_brief_ko ?? ''), '표지 이미지 설명'), 280),
    visual_prompt: validateVisualPrompt(String(raw.cover.visual_prompt ?? '')),
  };
  const bodyPages = raw.body_pages.map((page) => ({
    title: clamp(ensureKorean(String(page.title ?? ''), '본문 제목'), limits.body_title_max_chars),
    body: clamp(ensureKorean(String(page.body ?? ''), '본문'), limits.body_max_chars),
    visual_style: page.visual_style === 'illustration' ? 'illustration' as const : 'photo' as const,
    visual_brief_ko: clamp(ensureKorean(String(page.visual_brief_ko ?? ''), '본문 이미지 설명'), 280),
    visual_prompt: validateVisualPrompt(String(page.visual_prompt ?? '')),
  }));
  if (!cover.title || !cover.subtitle || !cover.visual_brief_ko || bodyPages.some((p) => !p.title || !p.body || !p.visual_brief_ko)) throw new Error('AI가 빈 카드 필드를 반환했습니다.');
  if (cover.visual_brief_ko.length < 35 || bodyPages.some((page) => page.visual_brief_ko.length < 35)) throw new Error('이미지 설명이 구체적인 장면을 검토하기에 너무 짧습니다. 다시 생성합니다.');
  if (cover.subtitle.length < limits.cover_subtitle_min_chars) throw new Error('표지 부제가 너무 짧습니다. 다시 생성합니다.');
  if (hasAiWritingCliche(`${cover.title} ${cover.subtitle}`)) throw new Error('표지에 상투적인 AI 문체가 포함됐습니다. 구체적인 기사형 헤드라인으로 다시 생성합니다.');
  assertDifferent(cover.title, cover.subtitle, '표지 제목과 부제');
  const seenSentences: string[] = [];
  for (const [index, page] of bodyPages.entries()) {
    if (page.title.length < limits.body_title_min_chars || page.body.length < limits.body_min_chars) throw new Error(`본문 ${index + 1}의 정보량이 카드 규격에 맞지 않습니다. 다시 생성합니다.`);
    const sentenceTotal = sentenceCount(page.body);
    if (sentenceTotal < limits.body_sentences_min || sentenceTotal > limits.body_sentences_max) throw new Error(`본문 ${index + 1}의 문장 수(${sentenceTotal})가 ${limits.body_sentences_min}~${limits.body_sentences_max}문장 기준에 맞지 않습니다. 다시 생성합니다.`);
    assertDifferent(page.title, page.body, `본문 ${index + 1}의 제목과 내용`);
    assertDifferent(cover.title, page.title, `표지와 본문 ${index + 1} 제목`);
    if (isPromotional(page.body)) throw new Error(`본문 ${index + 1}에 홍보·CTA 문구가 포함됐습니다. 다시 생성합니다.`);
    if (/(?:습니다|합니다|됩니다|입니다)[.!?]?/.test(`${page.title} ${page.body}`)) throw new Error(`본문 ${index + 1}이 존댓말 보고서 문체입니다. SRC Plus의 간결한 서술체로 다시 생성합니다.`);
    if (hasAiWritingCliche(`${page.title} ${page.body}`)) throw new Error(`본문 ${index + 1}에 상투적인 AI 문체가 포함됐습니다. 사실과 인과관계를 직접 서술하도록 다시 생성합니다.`);
    if (sentences(page.body).some((sentence) => [comparable(cover.title), comparable(cover.subtitle)].some((coverText) => coverText.length >= 15 && overlaps(sentence, coverText)))) throw new Error(`본문 ${index + 1}이 표지 문구를 반복했습니다. 다시 생성합니다.`);
    for (const sentence of sentences(page.body)) {
      if (seenSentences.some((seen) => overlaps(sentence, seen))) throw new Error(`본문 ${index + 1}이 앞 페이지 문장을 반복했습니다. 다시 생성합니다.`);
      seenSentences.push(sentence);
    }
  }
  if (new Set(bodyPages.map((page) => comparable(page.title))).size !== bodyPages.length) throw new Error('본문 제목이 서로 중복됐습니다. 다시 생성합니다.');
  const visualPlans = [cover.visual_brief_ko, ...bodyPages.map((page) => page.visual_brief_ko)].map(comparable);
  if (new Set(visualPlans).size !== visualPlans.length) throw new Error('표지와 본문의 이미지 장면이 서로 중복됐습니다. 페이지별 주장에 맞는 다른 장면으로 다시 생성합니다.');
  const visualPrompts = [cover.visual_prompt, ...bodyPages.map((page) => page.visual_prompt)].map(comparable);
  if (new Set(visualPrompts).size !== visualPrompts.length) throw new Error('표지와 본문의 이미지 프롬프트가 서로 중복됐습니다. 다시 생성합니다.');
  if (bodyPages.filter((page) => page.title.includes('?')).length > 2) throw new Error('본문 제목이 질문형으로 반복됩니다. 관찰형·결론형 제목을 섞어 다시 생성합니다.');
  if (bodyPages.filter((page) => /무엇(?:인가|일까)|이유는 무엇/.test(page.title)).length > 1) throw new Error("본문 제목에 '무엇인가' 형식이 반복됩니다. 다시 생성합니다.");
  const ctaSubject = clamp(ensureKorean(String(raw.cta_subject ?? '').replace(/에 대한$/, ''), '안내 문구 주제'), limits.cta_subject_max_chars);
  if (/src[_ ]?plus|무료|만나보|리포트|알아보|시작|계속|클릭/i.test(ctaSubject)) throw new Error('CTA 주제에 홍보·행동 유도 문구가 포함됐습니다. 명사구로 다시 생성합니다.');
  return {
    report_title: clamp(String(raw.report_title ?? cover.title).trim(), 120),
    category: ['insights', 'issues', 'sectors'].includes(raw.category) ? raw.category : 'issues',
    cover,
    body_pages: bodyPages,
    cta_subject: ctaSubject,
  };
}
function copyFields(raw: AiDraft): AiCopyDraft {
  return {
    report_title: raw.report_title,
    category: raw.category,
    cover: { title: raw.cover.title, subtitle: raw.cover.subtitle },
    body_pages: raw.body_pages.map((page) => ({ title: page.title, body: page.body })),
    cta_subject: raw.cta_subject,
  };
}
function mergeCopy(raw: AiDraft, copy: AiCopyDraft): AiDraft {
  return {
    ...raw,
    ...copy,
    cover: { ...raw.cover, ...copy.cover },
    body_pages: copy.body_pages.map((page, index) => ({ ...raw.body_pages[index], ...page })),
  };
}
function copyDraftWithPlaceholders(raw: AiCopyDraft): AiDraft {
  const placeholder = 'Documentary editorial scene with a specific physical asset and realistic materials, photographed in a real location. Wide composition, natural perspective, clear foreground, middle ground and background, restrained color grading, believable daylight, calm darker lower area for copy, no readable text, numbers, logos, signage or watermark.';
  const cover = raw.cover ?? { title: '', subtitle: '' };
  const bodyPages = Array.isArray(raw.body_pages) ? raw.body_pages : [];
  return {
    report_title: String(raw.report_title ?? cover.title ?? ''),
    category: ['insights', 'issues', 'sectors'].includes(raw.category) ? raw.category : 'issues',
    cover: { title: String(cover.title ?? ''), subtitle: String(cover.subtitle ?? ''), visual_style: 'photo', visual_brief_ko: '이미지 계획을 다음 단계에서 작성한다.', visual_prompt: placeholder },
    body_pages: bodyPages.map((page, index) => ({ title: String(page?.title ?? ''), body: String(page?.body ?? ''), visual_style: 'photo' as const, visual_brief_ko: `본문 ${index + 1} 이미지 계획을 다음 단계에서 작성한다.`, visual_prompt: `${placeholder} Scene ${index + 1}.` })),
    cta_subject: String(raw.cta_subject ?? cover.title ?? ''),
  };
}
async function repairDraftCopy(env: Env, source: unknown, raw: AiDraft, error: string): Promise<AiDraft> {
  const result = await runTextModel(env, {
    messages: [
      { role: 'system', content: `SRC Plus 카드뉴스 문구 교정자다. 이미지 계획은 다루지 않는다. 다음 중앙 편집 규칙을 반드시 적용한다.\n본문은 페이지마다 ${editorialRules.limits.body_sentences_min}~${editorialRules.limits.body_sentences_max}문장으로 맞춘다. 문체는 건조한 기사체(~다/~한다/~있다)로 통일하고 습니다/합니다/됩니다/입니다, 홍보 문구, AI 상투어를 금지한다. 제목과 본문, 표지와 본문, 페이지 사이의 중복을 제거한다. 페이지 수와 원문 근거는 유지한다.\n${JSON.stringify(editorialRules)}` },
      { role: 'user', content: `검증 오류: ${error}\n\n교정할 문구: ${JSON.stringify(copyFields(raw))}\n\n원문 근거: ${clamp(JSON.stringify(source), 18000)}\n\n검증 오류가 난 부분만 고치되 전체 문안을 다시 검증하고, 반드시 JSON 스키마에 맞는 완성본 하나만 반환하라.` },
    ],
    temperature: 0.1,
    max_tokens: 2400,
    response_format: { type: 'json_schema', json_schema: copyDraftSchema(raw.body_pages.length) },
  }) as { response?: AiCopyDraft };
  if (!result.response) throw new Error('문구 자동 교정 응답이 비어 있습니다.');
  return mergeCopy(raw, result.response);
}
function normalizeCopyDraft(raw: AiCopyDraft): AiDraft {
  const { limits, structure } = editorialRules;
  if (!raw?.cover || !Array.isArray(raw.body_pages) || raw.body_pages.length < structure.body_pages_min || raw.body_pages.length > structure.body_pages_max) throw new Error('AI 카드 문구 구조가 유효하지 않습니다.');
  const cover = {
    title: clamp(ensureKorean(String(raw.cover.title ?? ''), '표지 제목'), limits.cover_title_max_chars),
    subtitle: clamp(ensureKorean(String(raw.cover.subtitle ?? ''), '표지 부제'), limits.cover_subtitle_max_chars),
  };
  if (cover.subtitle.length < limits.cover_subtitle_min_chars) throw new Error('표지 부제가 너무 짧습니다. 다시 생성합니다.');
  if (hasAiWritingCliche(`${cover.title} ${cover.subtitle}`)) throw new Error('표지에 상투적인 AI 문체가 포함됐습니다.');
  assertDifferent(cover.title, cover.subtitle, '표지 제목과 부제');
  const bodyPages = raw.body_pages.map((page) => ({
    title: clamp(ensureKorean(String(page.title ?? ''), '본문 제목'), limits.body_title_max_chars),
    body: clamp(ensureKorean(String(page.body ?? ''), '본문'), limits.body_max_chars),
  }));
  const seenSentences: string[] = [];
  for (const [index, page] of bodyPages.entries()) {
    if (page.title.length < limits.body_title_min_chars || page.body.length < limits.body_min_chars) throw new Error(`본문 ${index + 1}의 정보량이 카드 규격에 맞지 않습니다.`);
    const count = sentenceCount(page.body);
    if (count < limits.body_sentences_min || count > limits.body_sentences_max) throw new Error(`본문 ${index + 1}의 문장 수가 기준에 맞지 않습니다.`);
    assertDifferent(page.title, page.body, `본문 ${index + 1}의 제목과 내용`);
    assertDifferent(cover.title, page.title, `표지와 본문 ${index + 1} 제목`);
    if (isPromotional(page.body) || /(?:습니다|합니다|됩니다|입니다)[.!?]?/.test(`${page.title} ${page.body}`) || hasAiWritingCliche(`${page.title} ${page.body}`)) throw new Error(`본문 ${index + 1} 문체가 중앙 규칙에 맞지 않습니다.`);
    for (const sentence of sentences(page.body)) {
      if (seenSentences.some((seen) => overlaps(sentence, seen))) throw new Error(`본문 ${index + 1}이 앞 페이지 문장을 반복했습니다.`);
      seenSentences.push(sentence);
    }
  }
  if (new Set(bodyPages.map((page) => comparable(page.title))).size !== bodyPages.length) throw new Error('본문 제목이 서로 중복됐습니다.');
  const ctaSubject = clamp(ensureKorean(String(raw.cta_subject ?? '').replace(/에 대한$/, ''), '안내 문구 주제'), limits.cta_subject_max_chars);
  if (/src[_ ]?plus|무료|만나보|리포트|알아보|시작|계속|클릭/i.test(ctaSubject)) throw new Error('CTA 주제가 행동 유도 문구입니다.');
  return copyDraftWithPlaceholders({
    report_title: clamp(String(raw.report_title ?? cover.title).trim(), 120),
    category: ['insights', 'issues', 'sectors'].includes(raw.category) ? raw.category : 'issues',
    cover,
    body_pages: bodyPages,
    cta_subject: ctaSubject,
  });
}
async function repairDraftVisuals(env: Env, source: unknown, raw: AiDraft, error: string): Promise<AiDraft> {
  const pageCount = raw.body_pages.length + 1;
  const schema = {
    type: 'object', properties: { pages: { type: 'array', minItems: pageCount, maxItems: pageCount, items: {
      type: 'object', properties: {
        page_no: { type: 'integer' }, visual_style: { type: 'string', enum: ['photo', 'illustration'] },
        visual_brief_ko: { type: 'string', minLength: 40 }, visual_prompt: { type: 'string', minLength: 300 },
      }, required: ['page_no', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
    } } }, required: ['pages'],
  };
  const currentPages = [
    { page_no: 1, title: raw.cover.title, body: raw.cover.subtitle, visual_style: raw.cover.visual_style, visual_brief_ko: raw.cover.visual_brief_ko, visual_prompt: raw.cover.visual_prompt },
    ...raw.body_pages.map((page, index) => ({ page_no: index + 2, title: page.title, body: page.body, visual_style: page.visual_style, visual_brief_ko: page.visual_brief_ko, visual_prompt: page.visual_prompt })),
  ];
  const result = await runTextModel(env, {
    messages: [
      { role: 'system', content: `SRC Plus 카드뉴스 비주얼 디렉터다. 문안은 바꾸지 않는다. 다음 중앙 비주얼 규칙을 빠짐없이 적용한다.\n${JSON.stringify(editorialRules.visual_direction)}` },
      { role: 'user', content: `검증 오류: ${error}\n원문 JSON: ${clamp(JSON.stringify(source), 32000)}\n현재 페이지: ${JSON.stringify(currentPages)}\n각 페이지마다 먼저 요약문의 한 가지 주장과 이를 뒷받침하는 원문 대목을 대조하고, 그 대목에 실제로 등장하는 자산·시설·장소·업무 행동 가운데 가장 구체적인 피사체 하나를 고른다. 원문에 없는 비유 소품을 만들지 않는다. 모든 페이지를 하나의 Getty Images풍 경제지 사진 시리즈로 다시 설계하라. 사람은 가능하면 넣지 않는다. 3명 이상은 넓은 공간에 작게 배치할 수 있고, 1~2명도 뒷모습·옆모습·원거리 작업자·작은 실루엣이면 허용하지만 얼굴과 개별 신원이 보이지 않아야 한다. 실내는 공간 구조와 작업 맥락을, 실외는 시설과 사람의 스케일 관계를 우선한다. 얼굴 클로즈업·헤드샷·인물 감정 중심 구도는 금지한다. visual_brief_ko는 선택한 피사체와 선택 근거가 드러나는 구체적인 한국어 2~3문장이다. visual_prompt는 90단어 이상의 영어 촬영 지시서이며 단일 장면, 피사체 행동, 장소, 카메라·렌즈·각도, 조명, 색보정, 하단 30~40% 안전 영역, 글자·숫자·로고·간판 금지를 모두 포함한다. 여백은 검은 바닥이나 빈 판처럼 보이지 않고 장면에 자연스럽게 이어져야 한다. 스케치·그림·애니메이션·카툰·회화·벡터·CGI·3D 렌더는 사용하지 않는다.` },
    ],
    temperature: 0.1, max_tokens: 3600, response_format: { type: 'json_schema', json_schema: schema },
  }) as { response?: { pages: Array<{ page_no: number; visual_style: 'photo' | 'illustration'; visual_brief_ko: string; visual_prompt: string }> } };
  if (!result.response?.pages || result.response.pages.length !== pageCount) throw new Error('이미지 계획 자동 교정 결과가 유효하지 않습니다.');
  const byPage = new Map(result.response.pages.map((page) => [page.page_no, page]));
  const coverVisual = byPage.get(1);
  if (!coverVisual) throw new Error('표지 이미지 계획 자동 교정 결과가 없습니다.');
  return {
    ...raw,
    cover: { ...raw.cover, visual_style: coverVisual.visual_style, visual_brief_ko: coverVisual.visual_brief_ko, visual_prompt: coverVisual.visual_prompt },
    body_pages: raw.body_pages.map((page, index) => {
      const visual = byPage.get(index + 2);
      if (!visual) throw new Error(`본문 ${index + 1} 이미지 계획 자동 교정 결과가 없습니다.`);
      return { ...page, visual_style: visual.visual_style, visual_brief_ko: visual.visual_brief_ko, visual_prompt: visual.visual_prompt };
    }),
  };
}
async function createVisualPlan(env: Env, source: unknown, draft: AiDraft): Promise<AiDraft> {
  const pageCount = draft.body_pages.length + 1;
  const schema = {
    type: 'object', properties: { pages: { type: 'array', minItems: pageCount, maxItems: pageCount, items: {
      type: 'object', properties: {
        page_no: { type: 'integer' }, visual_style: { type: 'string', enum: ['photo', 'illustration'] },
        visual_brief_ko: { type: 'string', minLength: 40 }, visual_prompt: { type: 'string', minLength: 650 },
      }, required: ['page_no', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
    } } }, required: ['pages'],
  };
  const copy = [
    { page_no: 1, title: draft.cover.title, body: draft.cover.subtitle },
    ...draft.body_pages.map((page, index) => ({ page_no: index + 2, title: page.title, body: page.body })),
  ];
  const result = await runTextModel(env, {
    messages: [
      { role: 'system', content: 'SRC Plus 카드뉴스의 이미지 계획만 작성한다. 문구는 절대 바꾸지 않는다. 중앙 비주얼 규칙을 적용한다.\n' + JSON.stringify(editorialRules.visual_direction) },
      { role: 'user', content: '원문 JSON:\n' + clamp(JSON.stringify(source), 32000) + '\n\n확정 문안:\n' + JSON.stringify(copy) + '\n\n페이지마다 단 하나의 구체적인 피사체와 단일 촬영 장면을 정한다. visual_prompt는 반드시 110~150개의 영어 단어로 작성하고 다음 10개 요소를 각각 포함한다: subject, visible state or action, exact place type, foreground/midground/background, camera distance, camera angle, lens, time and lighting, color grading, lower 30~40% text-safe area. 마지막에는 반드시 "No readable text, numbers, logos, signage or watermark."를 포함한다. "a photo of", "business image", "important", "concept", "a graph" 같은 추상 주제어만 쓰지 않는다. 장면을 설명하는 고유 명사와 물리적 디테일을 최소 6개 넣는다. 짧은 한두 문장 프롬프트를 절대 출력하지 않는다.' },
    ],
    temperature: 0.1, max_tokens: 5200, response_format: { type: 'json_schema', json_schema: schema },
  }) as { response?: { pages: Array<{ page_no: number; visual_style: 'photo' | 'illustration'; visual_brief_ko: string; visual_prompt: string }> } };
  const buildVisualDraft = (response: { pages: Array<{ page_no: number; visual_style: 'photo' | 'illustration'; visual_brief_ko: string; visual_prompt: string }> }): AiDraft => {
    if (!response?.pages || response.pages.length !== pageCount) throw new Error('이미지 계획 응답이 유효하지 않습니다.');
    const byPage = new Map(response.pages.map((page) => [page.page_no, page]));
    const coverVisual = byPage.get(1);
    if (!coverVisual) throw new Error('표지 이미지 계획이 없습니다.');
    return {
      ...draft,
      cover: { ...draft.cover, visual_style: coverVisual.visual_style, visual_brief_ko: coverVisual.visual_brief_ko, visual_prompt: coverVisual.visual_prompt },
      body_pages: draft.body_pages.map((page, index) => {
        const visual = byPage.get(index + 2); if (!visual) throw new Error('본문 ' + (index + 1) + ' 이미지 계획이 없습니다.');
        return { ...page, visual_style: visual.visual_style, visual_brief_ko: visual.visual_brief_ko, visual_prompt: visual.visual_prompt };
      }),
    };
  };
  let candidate: AiDraft;
  try {
    candidate = buildVisualDraft(result.response as { pages: Array<{ page_no: number; visual_style: 'photo' | 'illustration'; visual_brief_ko: string; visual_prompt: string }> });
  } catch (error) {
    candidate = draft;
  }
  let lastError = '이미지 계획 검증 실패';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const normalizeVisual = (visual: { visual_style: 'photo' | 'illustration'; visual_brief_ko: string; visual_prompt: string }) => ({
        visual_style: visual.visual_style, visual_brief_ko: visual.visual_brief_ko, visual_prompt: validateVisualPrompt(visual.visual_prompt),
      });
      return {
        ...candidate,
        cover: { ...candidate.cover, ...normalizeVisual(candidate.cover) },
        body_pages: candidate.body_pages.map((page) => ({ ...page, ...normalizeVisual(page) })),
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === 2) break;
      candidate = await repairDraftVisuals(env, source, candidate, lastError);
    }
  }
  throw new Error(`이미지 프롬프트 자동 교정 실패: ${lastError}`);
}
async function createDraft(env: Env, source: unknown, previous: PageRow[], instruction?: string): Promise<AiDraft> {
  const system = `당신은 SRC Plus의 한국어 인스타그램 카드뉴스 편집자다.
다음 중앙 편집 규칙 JSON을 최초 생성, 수정, 전체 재생성에 예외 없이 적용한다.
examples.patterns의 중괄호를 원문 내용으로 바꿔 구조와 톤만 참고한다. 패턴 문구나 중괄호를 출력하지 않고 examples.bad의 패턴은 만들지 않는다.
${JSON.stringify(editorialRules, null, 2)}
이번 호출은 문안 전용 1단계다. cover와 body_pages에는 title과 body만 작성하고 visual_style, visual_brief_ko, visual_prompt는 출력하지 않는다. 이미지 계획은 문안 승인 뒤 별도 호출에서 작성한다.
visual_brief_ko는 사용자가 검토할 한국어 이미지 설명이다.
이번 호출에서는 이미지 필드를 만들지 않는다. 이미지 계획은 문안 승인 뒤 별도의 호출에서 작성한다.`;
  const baseUser = `구조화된 리포트 JSON:\n${clamp(JSON.stringify(source), 42000)}\n\n현재 초안:\n${previous.length ? clamp(JSON.stringify(previous.map((p) => ({ page_no: p.page_no, page_kind: p.page_kind, title: p.title, body: p.body, visual_style: p.visual_style, visual_brief_ko: p.visual_brief_ko, visual_prompt: p.visual_prompt }))), 18000) : '없음'}\n\n수정 지시:\n${instruction ?? '새 카드뉴스 초안을 작성하라.'}`;
  const result = await runTextModel(env, {
    messages: [{ role: 'system', content: system }, { role: 'user', content: baseUser }],
    temperature: 0.2,
    max_tokens: 5000,
    response_format: { type: 'json_schema', json_schema: copyDraftSchema(editorialRules.structure.body_pages_preferred ?? editorialRules.structure.body_pages_min) },
  }) as { response?: AiCopyDraft };
  if (!result.response) throw new Error('Workers AI가 구조화 응답을 반환하지 않았습니다.');
  let candidate = result.response;
  let lastError = '문안 검증 실패';
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return normalizeCopyDraft(candidate);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt === 2) break;
      const repaired = await repairDraftCopy(env, source, copyDraftWithPlaceholders(candidate), lastError);
      candidate = copyFields(repaired);
    }
  }
  throw new Error(`AI 문안 자동 교정 실패: ${lastError}`);
}
async function replacePages(env: Env, jobId: string, draft: AiDraft): Promise<void> {
  const pages: Array<Omit<PageRow, 'job_id' | 'image_a_key' | 'image_b_key' | 'selected_key' | 'qa_a_json' | 'qa_b_json' | 'status'>> = [];
  pages.push({ page_no: 1, page_kind: 'cover', title: draft.cover.title, body: draft.cover.subtitle, visual_style: draft.cover.visual_style, visual_brief_ko: draft.cover.visual_brief_ko, visual_prompt: draft.cover.visual_prompt, image_required: 1, reuse_page_no: null });
  draft.body_pages.forEach((page, index) => pages.push({ page_no: index + 2, page_kind: 'body', title: page.title, body: page.body, visual_style: page.visual_style, visual_brief_ko: page.visual_brief_ko, visual_prompt: page.visual_prompt, image_required: 1, reuse_page_no: null }));
  const lastBodyNo = pages[pages.length - 1].page_no;
  pages.push({ page_no: lastBodyNo + 1, page_kind: 'cta', title: draft.cta_subject, body: `${draft.cta_subject}${CTA_SUFFIX}`, visual_style: 'photo', visual_brief_ko: '직전 본문 페이지와 같은 이미지를 사용한다.', visual_prompt: '', image_required: 0, reuse_page_no: lastBodyNo });
  const statements: D1PreparedStatement[] = [env.DB.prepare('DELETE FROM pages WHERE job_id = ?').bind(jobId)];
  for (const page of pages) statements.push(env.DB.prepare(`INSERT INTO pages(job_id,page_no,page_kind,title,body,visual_style,visual_brief_ko,visual_prompt,image_required,reuse_page_no,status,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?, 'COPY_DRAFTED', ?)`).bind(jobId, page.page_no, page.page_kind, page.title, page.body, page.visual_style, page.visual_brief_ko, page.visual_prompt, page.image_required, page.reuse_page_no, now()));
  await env.DB.batch(statements);
  const job = await getJob(env, jobId);
  await updateJob(env, jobId, { report_title: draft.report_title, report_category: draft.category, page_count: pages.length, status: 'COPY_DRAFTED', copy_version: (job?.copy_version ?? 0) + 1 });
}
async function revisePrompts(env: Env, source: unknown, pages: PageRow[], instruction: string): Promise<void> {
  const targets = pages.filter((p) => p.image_required);
  const schema = {
    type: 'object', properties: { pages: { type: 'array', minItems: targets.length, maxItems: targets.length, items: {
      type: 'object', properties: { page_no: { type: 'integer' }, visual_style: { type: 'string', enum: ['photo', 'illustration'] }, visual_brief_ko: { type: 'string' }, visual_prompt: { type: 'string' } }, required: ['page_no', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
    } } }, required: ['pages'],
  };
  const result = await runTextModel(env, {
    messages: [
      { role: 'system', content: `이미지 계획만 수정한다. 다음 중앙 비주얼 규칙을 빠짐없이 적용한다. ${JSON.stringify(editorialRules.visual_direction)} visual_brief_ko는 한국어, visual_prompt는 영어다. 각 페이지의 한 가지 주장과 이를 뒷받침하는 원문 대목을 대조한 뒤, 원문에 등장하는 자산·시설·장소·업무 행동 중 가장 구체적인 피사체 하나를 선택한다. 사람은 가능하면 제외하고, 3명 이상은 넓은 공간에 작게 배치하며 1~2명은 뒷모습·옆모습·원거리 작업자·작은 실루엣일 때만 허용한다. 얼굴·표정·개별 신원과 인물 감정이 초점이 되면 안 된다. 실내는 공간 구조와 작업 맥락을, 실외는 시설·지형과 사람의 스케일 관계를 우선한다. 원문에 없는 비유 소품을 만들지 않는다. 구체적인 Getty Images풍 단일 에디토리얼 장면으로 설계한다. photo가 기본이며 실제 장면으로 설명할 수 없을 때만 사실적인 사진 기반 합성을 사용한다. 스케치·그림·애니메이션·카툰·회화·벡터·CGI·3D 렌더는 금지한다. 특정 기업명과 브랜드는 관련 산업·자산·사용 맥락으로 바꾸고 이미지 내부 글자·숫자·로고·간판·워터마크를 금지한다.` },
      { role: 'user', content: `원문 JSON: ${clamp(JSON.stringify(source), 32000)}\n현재 페이지: ${JSON.stringify(targets.map((p) => ({ page_no: p.page_no, title: p.title, body: p.body, visual_style: p.visual_style, visual_brief_ko: p.visual_brief_ko, visual_prompt: p.visual_prompt })))}\n수정 지시: ${instruction}` },
    ],
    temperature: 0.2, max_tokens: 2600, response_format: { type: 'json_schema', json_schema: schema },
  }) as { response?: { pages: Array<{ page_no: number; visual_style: string; visual_brief_ko: string; visual_prompt: string }> } };
  if (!result.response?.pages || result.response.pages.length !== targets.length) throw new Error('이미지 프롬프트 수정 결과가 유효하지 않습니다.');
  const statements = result.response.pages.map((page) => env.DB.prepare(`UPDATE pages SET visual_style=?,visual_brief_ko=?,visual_prompt=?,image_a_key=NULL,image_b_key=NULL,selected_key=NULL,qa_a_json=NULL,qa_b_json=NULL,status='COPY_DRAFTED',updated_at=? WHERE job_id=? AND page_no=?`)
    .bind(page.visual_style === 'illustration' ? 'illustration' : 'photo', clamp(page.visual_brief_ko.trim(), 280), validateVisualPrompt(page.visual_prompt), now(), targets[0].job_id, page.page_no));
  await env.DB.batch(statements);
}
interface GeneratedImage { bytes: Uint8Array; contentType: string; source?: Record<string, string>; }
async function generateImage(env: Env, page: PageRow, seed: number): Promise<GeneratedImage> {
  const policy = page.visual_style === 'illustration' ? IMAGE_POLICY_ILLUSTRATION : IMAGE_POLICY_PHOTO;
  const result = await runImageModel(env, {
    prompt: `${policy} Subject and scene: ${page.visual_prompt}`,
    width: env.IMAGE_WIDTH || '960', height: env.IMAGE_HEIGHT || '1280', seed,
  }) as { image?: string; contentType?: string; source?: Record<string, string> };
  if (!result.image) throw new Error('이미지 provider가 이미지를 반환하지 않았습니다.');
  return { bytes: base64ToBytes(result.image), contentType: result.contentType ?? 'image/png', source: result.source };
}
async function generateAndStoreImage(env: Env, jobId: string, page: PageRow, variant: 'a' | 'b', nonce?: string): Promise<void> {
  const generated = await generateImage(env, page, seedFor(jobId, page.page_no, variant, nonce));
  const bytes = generated.bytes;
  const qa = await assessImage(env, page, bytes);
  if (generated.source) qa.source = generated.source;
  const extension = generated.contentType.includes('webp') ? 'webp' : generated.contentType.includes('jpeg') || generated.contentType.includes('jpg') ? 'jpg' : 'png';
  const key = `jobs/${jobId}/images/page-${String(page.page_no).padStart(2, '0')}-${variant}-${nonce ?? 'initial'}.${extension}`;
  await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: generated.contentType } });
  const column = variant === 'a' ? 'image_a_key' : 'image_b_key';
  const qaColumn = variant === 'a' ? 'qa_a_json' : 'qa_b_json';
  await env.DB.prepare(`UPDATE pages SET ${column}=?,${qaColumn}=?,status='IMAGE_GENERATING',updated_at=? WHERE job_id=? AND page_no=?`).bind(key, JSON.stringify(qa), now(), jobId, page.page_no).run();
}
async function assessImage(env: Env, page: PageRow, image: Uint8Array): Promise<Record<string, unknown>> {
  if ((env.VISION_QA_MODE || 'off') === 'off') return { mode: 'off' };
  const schema = { type: 'object', properties: {
    has_readable_text: { type: 'boolean' }, has_logo_or_brand: { type: 'boolean' }, has_watermark: { type: 'boolean' }, obvious_ai_artifacts: { type: 'boolean' }, composition_fit: { type: 'boolean' }, people_face_focus: { type: 'boolean' }, people_role_fit: { type: 'boolean' }, space_type_fit: { type: 'boolean' },
    semantic_fit_score: { type: 'integer', minimum: 1, maximum: 5 }, editorial_tone_score: { type: 'integer', minimum: 1, maximum: 5 }, realism_score: { type: 'integer', minimum: 1, maximum: 5 }, notes_ko: { type: 'string' },
  }, required: ['has_readable_text', 'has_logo_or_brand', 'has_watermark', 'obvious_ai_artifacts', 'composition_fit', 'people_face_focus', 'people_role_fit', 'space_type_fit', 'semantic_fit_score', 'editorial_tone_score', 'realism_score', 'notes_ko'] };
  try {
    const result = await runVisionModel(env, {
      messages: [
        { role: 'system', content: 'SRC Plus 카드뉴스의 비주얼 디렉터다. 실제로 보이는 요소만 판단하고 한국어로 짧고 구체적으로 메모한다.' },
        { role: 'user', content: `페이지 제목: ${page.title}\n페이지 본문: ${page.body}\n의도한 이미지: ${page.visual_brief_ko}\n이 이미지가 페이지 주장과 직접 연결되는지, 프리미엄 경제지·Getty Images풍 에디토리얼 톤인지, 실제 사진 또는 사실적인 사진 기반 합성으로 그럴듯한지 각각 1~5점으로 평가하라. 장면의 시설 규모와 사람의 행동이 현업에서 실제로 있을 법한지도 현실감 점수에 반영한다. 읽을 수 있는 글자·숫자·간판뿐 아니라 화살표, X 표시, 신호 아이콘, 차선 기호처럼 의미를 가진 인공 그래픽도 발견하면 실패로 표시한다. 기업 로고·브랜드, 워터마크, 명백한 AI 왜곡과 3:4 카드 하단 30~40% 텍스트 안전 영역도 검사하라. 안전 영역이 빈 검은 바닥이나 판처럼 부자연스럽게 보이는지도 확인하라.` },
        { role: 'user', content: '추가 시각 QA: 사람이 보이면 people_face_focus는 얼굴이나 표정이 화면의 주제가 될 때만 true. people_role_fit은 인물이 공간의 규모·작업 맥락을 보조하면 true이며, 1~2명도 뒷모습·옆모습·원거리·작은 실루엣이면 허용한다. space_type_fit은 실내라면 천장·창·작업대·시설 구조가, 실외라면 지형·도로·수면·구조물과 인물의 스케일 관계가 주제와 맞는지 평가한다. 얼굴 클로즈업, 헤드샷, 감정 중심 인물은 실패다.' },
      ],
      image: `data:image/png;base64,${bytesToBase64(image)}`,
      max_tokens: 400,
      temperature: 0,
      response_format: { type: 'json_schema', json_schema: schema },
    }) as { response?: Record<string, unknown> };
    return result.response ?? { error: 'no_response' };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), mode: 'advisory' };
  }
}
function qaCaption(jsonText: string | null): string {
  if (!jsonText) return '자동 QA 결과 없음';
  try {
    const qa = JSON.parse(jsonText) as Record<string, unknown>;
    if (qa.error) return `자동 QA 미실행: ${qa.error}`;
    const flags: string[] = [];
    if (qa.has_readable_text) flags.push('글자 감지');
    if (qa.has_logo_or_brand) flags.push('로고·브랜드 의심');
    if (qa.has_watermark) flags.push('워터마크 의심');
    if (qa.obvious_ai_artifacts) flags.push('AI 왜곡 의심');
    if (qa.composition_fit === false) flags.push('텍스트 영역 부족');
    if (qa.people_face_focus) flags.push('인물 얼굴 중심');
    if (qa.people_role_fit === false) flags.push('인물 역할 부적합');
    if (qa.space_type_fit === false) flags.push('실내·실외 공간 부적합');
    if (Number(qa.semantic_fit_score ?? 0) < 4) flags.push('문맥 적합성 재검토');
    if (Number(qa.editorial_tone_score ?? 0) < 4) flags.push('에디토리얼 톤 재검토');
    if (Number(qa.realism_score ?? 0) < 4) flags.push('현실감 재검토');
    const scores = `문맥 ${String(qa.semantic_fit_score ?? '-')} · 톤 ${String(qa.editorial_tone_score ?? '-')} · 현실감 ${String(qa.realism_score ?? '-')}`;
    const source = qa.source as Record<string, unknown> | undefined;
    const sourceNote = source?.landing_url ? ` · 출처 ${String(source.landing_url)} · ${String(source.license ?? '')} · ${String(source.creator ?? '')}` : '';
    return flags.length ? `주의: ${flags.join(', ')} · ${scores} · ${String(qa.notes_ko ?? '')}${sourceNote}` : `자동 QA · ${scores} · ${String(qa.notes_ko ?? '')}${sourceNote}`;
  } catch { return '자동 QA 결과 해석 실패'; }
}

async function sendCopyReview(env: Env, job: JobRow): Promise<void> {
  const pages = await getPages(env, job.id);
  const text = pages.map((page) => {
    if (page.page_kind === 'cover') return `[표지]\n${page.title}\n— ${page.body}`;
    if (page.page_kind === 'cta') return `[마지막 안내 · 고정 문구]\n${page.body}`;
    return `[본문 ${page.page_no - 1}] ${page.title}\n${page.body}`;
  }).join('\n\n');
  await sendLongMessage(env, job.chat_id, `문구 초안 · ${job.id}\n\n${text}`);
  await sendMessage(env, job.chat_id, '문구를 승인하거나 수정하세요.', [[
    { text: '문구 승인', callback_data: `ca:${job.id}` }, { text: '수정 요청', callback_data: `ce:${job.id}` },
  ], [{ text: '전체 재생성', callback_data: `cr:${job.id}` }, { text: '취소', callback_data: `cx:${job.id}` }]]);
}
async function sendPromptReview(env: Env, job: JobRow): Promise<void> {
  const pages = (await getPages(env, job.id)).filter((p) => p.image_required);
  const text = pages.map((page) => `[${page.page_kind === 'cover' ? '표지' : `본문 ${page.page_no - 1}`}] ${page.visual_style === 'photo' ? '사실적 편집 사진' : '자연스러운 편집 일러스트'}\n${page.visual_brief_ko}`).join('\n\n');
  await sendLongMessage(env, job.chat_id, `이미지 계획 · ${job.id}\n\n${text}\n\n마지막 안내 페이지는 직전 본문 이미지와 같은 이미지를 재사용합니다.`);
  await sendMessage(env, job.chat_id, '이미지 계획을 승인하면 페이지당 A/B 두 안을 생성합니다.', [[
    { text: '승인·이미지 생성', callback_data: `pa:${job.id}` }, { text: '계획 수정', callback_data: `pe:${job.id}` },
  ]]);
}
async function sendImageReview(env: Env, jobId: string, pageNo: number): Promise<void> {
  const job = await getJob(env, jobId);
  const page = await env.DB.prepare('SELECT * FROM pages WHERE job_id=? AND page_no=?').bind(jobId, pageNo).first<PageRow>();
  if (!job || !page?.image_a_key || !page.image_b_key) return;
  const [a, b] = await Promise.all([env.ASSETS.get(page.image_a_key), env.ASSETS.get(page.image_b_key)]);
  if (!a || !b) throw new Error('R2 이미지 후보를 찾지 못했습니다.');
  await sendPhoto(env, job.chat_id, new Uint8Array(await a.arrayBuffer()), `${pageNo}페이지 A\n${qaCaption(page.qa_a_json)}`);
  await sendPhoto(env, job.chat_id, new Uint8Array(await b.arrayBuffer()), `${pageNo}페이지 B\n${qaCaption(page.qa_b_json)}`);
  await sendMessage(env, job.chat_id, `${pageNo}페이지 이미지를 선택하세요.\n${page.visual_brief_ko}`, [[
    { text: 'A 선택', callback_data: `ia:${jobId}:${pageNo}` }, { text: 'B 선택', callback_data: `ib:${jobId}:${pageNo}` }, { text: '재생성', callback_data: `ir:${jobId}:${pageNo}` },
  ]]);
}
async function allCandidatesReady(env: Env, jobId: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM pages WHERE job_id=? AND image_required=1 AND (image_a_key IS NULL OR image_b_key IS NULL)`).bind(jobId).first<{ count: number }>();
  return (row?.count ?? 1) === 0;
}
async function maybeRender(env: Env, job: JobRow): Promise<void> {
  const row = await env.DB.prepare(`SELECT COUNT(*) AS count FROM pages WHERE job_id=? AND image_required=1 AND selected_key IS NULL`).bind(job.id).first<{ count: number }>();
  if ((row?.count ?? 1) !== 0) return;
  const result = await env.DB.prepare(`UPDATE jobs SET status='RENDERING',updated_at=? WHERE id=? AND status IN ('IMAGES_GENERATED','IMAGE_GENERATING')`).bind(now(), job.id).run();
  if ((result.meta.changes ?? 0) > 0) {
    await env.JOBS.send({ type: 'dispatch_render', jobId: job.id });
    await sendMessage(env, job.chat_id, '모든 이미지 선택이 끝났습니다. PPTX와 PNG를 생성합니다.');
  }
}
async function buildRenderManifest(env: Env, job: JobRow): Promise<string> {
  const pages = await getPages(env, job.id);
  const selected = new Map(pages.filter((p) => p.selected_key).map((p) => [p.page_no, p.selected_key as string]));
  const manifestPages = pages.map((page) => {
    const imageKey = page.image_required ? page.selected_key : selected.get(page.reuse_page_no ?? -1);
    if (!imageKey) throw new Error(`${page.page_no}페이지 이미지가 선택되지 않았습니다.`);
    const qaText = imageKey === page.image_a_key ? page.qa_a_json : page.qa_b_json;
    let imageSource: unknown = undefined;
    try { imageSource = qaText ? JSON.parse(qaText).source : undefined; } catch { imageSource = undefined; }
    return { page_no: page.page_no, page_kind: page.page_kind, title: page.title, body: page.body, image_key: imageKey, image_source: imageSource, reuse_page_no: page.reuse_page_no };
  });
  const key = `jobs/${job.id}/render-manifest.json`;
  await env.ASSETS.put(key, JSON.stringify({ job_id: job.id, source_path: job.source_path, report_title: job.report_title, category: job.report_category, pages: manifestPages }, null, 2), { httpMetadata: { contentType: 'application/json' } });
  await updateJob(env, job.id, { render_manifest_key: key });
  return key;
}
async function deliverFinal(env: Env, job: JobRow): Promise<void> {
  let current = job;
  if (!current.final_pptx_key || !current.final_zip_key) return;
  const pptxKey = current.final_pptx_key;
  const zipKey = current.final_zip_key;
  if (!current.pptx_sent) {
    const object = await env.ASSETS.get(pptxKey);
    if (!object) throw new Error('PPTX 결과를 찾지 못했습니다.');
    await sendDocument(env, current.chat_id, new Uint8Array(await object.arrayBuffer()), `${fileName(current.source_path).replace(/\.html$/i, '')}_cardnews.pptx`, `카드뉴스 PPTX · ${current.id}`);
    await updateJob(env, current.id, { pptx_sent: 1 });
    current = (await getJob(env, current.id)) as JobRow;
  }
  if (!current.zip_sent) {
    const object = await env.ASSETS.get(zipKey);
    if (!object) throw new Error('PNG ZIP 결과를 찾지 못했습니다.');
    await sendDocument(env, current.chat_id, new Uint8Array(await object.arrayBuffer()), `${fileName(current.source_path).replace(/\.html$/i, '')}_png.zip`, `인스타그램용 PNG ZIP · ${current.id}`);
    await updateJob(env, current.id, { zip_sent: 1 });
    current = (await getJob(env, current.id)) as JobRow;
  }
  if (!current.final_notice_sent) {
    await sendMessage(env, current.chat_id, '최종 파일 생성이 끝났습니다. 마지막 문구·수치·이미지 저작권을 확인한 뒤 게시하세요.', [[{ text: '최종 승인', callback_data: `fa:${current.id}` }]]);
    await updateJob(env, current.id, { final_notice_sent: 1 });
  }
}

async function processTask(env: Env, task: QueueTask): Promise<void> {
  const job = await getJob(env, task.jobId);
  if (!job) throw new Error(`작업 ${task.jobId}을 찾지 못했습니다.`);
  if (job.status === 'CANCELLED' || job.status === 'FINAL_APPROVED') return;
  if (task.type === 'dispatch_parse') {
    if (job.status !== 'CHATGPT_DRAFTING') await updateJob(env, job.id, { status: 'PARSING', last_error: null });
    await dispatchGithub(env, 'parse', job.id, job.source_path);
    return;
  }
  if (task.type === 'draft_copy') {
    await updateJob(env, job.id, { status: 'COPY_DRAFTING', last_error: null });
    await sendMessage(env, job.chat_id, `원문을 읽고 문안만 작성합니다.\n작업: ${job.id}`);
    const sourceObject = await env.ASSETS.get(job.source_key ?? `jobs/${job.id}/source.json`);
    if (!sourceObject) throw new Error('파싱된 원문 JSON을 찾지 못했습니다.');
    const source = JSON.parse(new TextDecoder().decode(await sourceObject.arrayBuffer())) as unknown;
    const draft = await createDraft(env, source, await getPages(env, job.id), task.instruction);
    await replacePages(env, job.id, draft);
    await sendCopyReview(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  if (task.type === 'draft_visuals') {
    const sourceObject = await env.ASSETS.get(job.source_key ?? `jobs/${job.id}/source.json`);
    if (!sourceObject) throw new Error('파싱된 원문 JSON을 찾지 못했습니다.');
    const source = JSON.parse(new TextDecoder().decode(await sourceObject.arrayBuffer())) as unknown;
    const pages = await getPages(env, job.id);
    const cover = pages.find((page) => page.page_kind === 'cover');
    const body = pages.filter((page) => page.page_kind === 'body');
    if (!cover) throw new Error('표지 문안을 찾지 못했습니다.');
    const draft: AiDraft = {
      report_title: job.report_title ?? cover.title, category: (job.report_category as AiDraft['category']) ?? 'issues',
      cover: { title: cover.title, subtitle: cover.body, visual_style: cover.visual_style, visual_brief_ko: cover.visual_brief_ko, visual_prompt: cover.visual_prompt },
      body_pages: body.map((page) => ({ title: page.title, body: page.body, visual_style: page.visual_style, visual_brief_ko: page.visual_brief_ko, visual_prompt: page.visual_prompt })),
      cta_subject: pages.find((page) => page.page_kind === 'cta')?.title ?? cover.title,
    };
    await progress(env, job, 'PROMPT_DRAFTING', '문안 승인 확인. 이미지 계획을 작성합니다.');
    let visualDraft: AiDraft;
    try {
      visualDraft = await createVisualPlan(env, source, draft);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await updateJob(env, job.id, { status: 'FAILED_RETRYABLE', last_error: reason });
      await sendMessage(env, job.chat_id, `이미지 계획을 만들지 못했습니다. 문안은 보존되어 있습니다.\n${userFacingAiError(reason)}\n작업: ${job.id}`);
      throw error;
    }
    await replacePages(env, job.id, visualDraft);
    await updateJob(env, job.id, { status: 'PROMPT_DRAFTED' });
    await sendPromptReview(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  if (task.type === 'revise_prompts') {
    const sourceObject = await env.ASSETS.get(job.source_key ?? `jobs/${job.id}/source.json`);
    if (!sourceObject) throw new Error('파싱된 원문 JSON을 찾지 못했습니다.');
    const source = JSON.parse(new TextDecoder().decode(await sourceObject.arrayBuffer())) as unknown;
    await revisePrompts(env, source, await getPages(env, job.id), task.instruction);
    await sendPromptReview(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  if (task.type === 'generate_image') {
    const page = await env.DB.prepare('SELECT * FROM pages WHERE job_id=? AND page_no=?').bind(job.id, task.pageNo).first<PageRow>();
    if (!page || !page.image_required) throw new Error('이미지 생성 대상 페이지가 아닙니다.');
    await generateAndStoreImage(env, job.id, page, task.variant, task.nonce ?? 'initial');
    const notify = await env.DB.prepare(`UPDATE pages SET status='IMAGE_REVIEW_SENT',updated_at=?
      WHERE job_id=? AND page_no=? AND image_a_key IS NOT NULL AND image_b_key IS NOT NULL AND status!='IMAGE_REVIEW_SENT'`)
      .bind(now(), job.id, page.page_no).run();
    if ((notify.meta.changes ?? 0) > 0) await sendImageReview(env, job.id, page.page_no);
    if (await allCandidatesReady(env, job.id)) await updateJob(env, job.id, { status: 'IMAGES_GENERATED' });
    return;
  }
  if (task.type === 'dispatch_render') {
    await buildRenderManifest(env, job);
    await dispatchGithub(env, 'render', job.id, job.source_path);
    return;
  }
  if (task.type === 'notify_rendered') { await deliverFinal(env, job); }
}
async function handleQueue(batch: MessageBatch<QueueTask>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try { await processTask(env, message.body); message.ack(); }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const userReason = userFacingAiError(reason);
      const job = await getJob(env, message.body.jobId);
      if (job) await updateJob(env, job.id, { last_error: reason });
      const nonRetryable = /daily free allocation|free allocation of 10,000 neurons|무료 할당량|4006|3036/i.test(reason);
      if (nonRetryable || message.attempts >= 10) {
        await markFailure(env, message.body.jobId, error);
        if (job) await sendMessage(env, job.chat_id, `작업 실패 · ${job.id}\n${userReason}`);
        message.ack();
      } else {
        if (message.attempts === 1 && job) await sendMessage(env, job.chat_id, `검증을 통과할 때까지 자동 교정을 이어갑니다(최대 10회).\n현재 단계: ${message.body.type}\n작업: ${job.id}`);
        message.retry({ delaySeconds: Math.min(60, message.attempts * 8) });
      }
    }
  }
}

async function showReports(env: Env, chatId: string, mode: 'chatgpt' | 'legacy' = 'chatgpt'): Promise<void> {
  const reports = (await listReports(env)).slice(0, 16);
  if (!reports.length) { await sendMessage(env, chatId, 'published=true인 최종 리포트를 찾지 못했습니다.'); return; }
  await env.DB.prepare("DELETE FROM file_choices WHERE created_at < datetime('now','-1 day')").run();
  const choices = reports.map((report) => ({ ...report, id: shortId(10) }));
  await env.DB.batch(choices.map((choice) => env.DB.prepare('INSERT INTO file_choices(choice_id,chat_id,source_path) VALUES(?,?,?)').bind(choice.id, chatId, choice.path)));
  const action = mode === 'chatgpt' ? 'hs' : 'fs';
  const intro = mode === 'chatgpt'
    ? 'ChatGPT 작업 패킷으로 만들 Git 리포트를 선택하세요. 수정본과 보류 후 발행본도 현재 main의 published=true HTML에서 고를 수 있습니다.'
    : '기존 무료 AI 경로로 만들 리포트를 선택하세요.';
  await sendMessage(env, chatId, intro, choices.map((choice) => [{ text: `${choice.date} · ${clamp(choice.title, 42)}`, callback_data: `${action}:${choice.id}` }]));
}
async function showJobs(env: Env, chatId: string): Promise<void> {
  const result = await env.DB.prepare('SELECT * FROM jobs WHERE chat_id=? ORDER BY created_at DESC LIMIT 10').bind(chatId).all<JobRow>();
  if (!result.results.length) { await sendMessage(env, chatId, '아직 생성한 작업이 없습니다.'); return; }
  await sendMessage(env, chatId, result.results.map((job) => `${job.id} · ${job.status}\n${fileName(job.source_path)}${job.last_error ? `\n${clamp(userFacingAiError(job.last_error), 420)}` : ''}`).join('\n\n'));
}
async function latestRecoverableJob(env: Env, chatId: string): Promise<JobRow | null> {
  const result = await env.DB.prepare(`SELECT * FROM jobs WHERE chat_id=? AND status IN ('FAILED_RETRYABLE','COPY_DRAFTING','COPY_DRAFTED','COPY_APPROVED','PROMPT_DRAFTING','PROMPT_DRAFTED') ORDER BY updated_at DESC LIMIT 1`).bind(chatId).first<JobRow>();
  return result ?? null;
}
function isVisualRecovery(job: JobRow): boolean {
  return /이미지|프롬프트|visual|flux/i.test(job.last_error ?? '') || job.status === 'PROMPT_DRAFTING' || job.status === 'PROMPT_DRAFTED';
}
async function enqueueMissingImages(env: Env, job: JobRow): Promise<boolean> {
  const pages = (await getPages(env, job.id)).filter((page) => page.image_required && (page.status === 'IMAGE_GENERATING' || page.image_a_key || page.image_b_key));
  if (!pages.length) return false;
  await updateJob(env, job.id, { status: 'IMAGE_GENERATING', last_error: null });
  for (const page of pages) {
    if (!page.image_a_key) await env.JOBS.send({ type: 'generate_image', jobId: job.id, pageNo: page.page_no, variant: 'a', nonce: shortId(6) });
    if (!page.image_b_key) await env.JOBS.send({ type: 'generate_image', jobId: job.id, pageNo: page.page_no, variant: 'b', nonce: shortId(6) });
  }
  return true;
}
async function handleChatGptJsonDocument(env: Env, message: TelegramMessage): Promise<boolean> {
  const document = message.document;
  if (!document || !/\.json$/i.test(document.file_name ?? '')) return false;
  const chatId = String(message.chat.id);
  const prompt = await env.DB.prepare("SELECT message_id,job_id FROM telegram_prompts WHERE chat_id=? AND purpose='import_chatgpt_json' ORDER BY created_at DESC LIMIT 1")
    .bind(chatId).first<{ message_id: number; job_id: string }>();
  if (!prompt) return false;
  const job = await getJob(env, prompt.job_id);
  if (!job || job.chat_id !== chatId) return false;
  const file = await downloadTelegramFile(env, document.file_id);
  if (file.bytes.byteLength > 1_000_000) throw new Error('ChatGPT JSON 파일이 너무 큽니다. 텍스트 JSON만 보내세요.');
  const raw = JSON.parse(new TextDecoder().decode(file.bytes)) as AiDraft;
  const draft = normalizeDraft(raw);
  await replacePages(env, job.id, draft);
  await updateJob(env, job.id, { status: 'PROMPT_DRAFTED', last_error: null });
  await env.DB.prepare('DELETE FROM telegram_prompts WHERE chat_id=? AND message_id=?').bind(chatId, prompt.message_id).run();
  await sendManualPromptReview(env, (await getJob(env, job.id)) as JobRow);
  return true;
}
async function handleManualImageAttachment(env: Env, message: TelegramMessage): Promise<boolean> {
  const chatId = String(message.chat.id);
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE chat_id=? AND status='MANUAL_IMAGE_UPLOADING' ORDER BY updated_at DESC LIMIT 1").bind(chatId).first<JobRow>();
  if (!job) return false;
  const page = (await getPages(env, job.id)).find((item) => item.image_required && !item.selected_key);
  if (!page) return false;
  const photo = message.photo?.at(-1);
  const document = message.document;
  const fileId = photo?.file_id ?? (document?.mime_type?.startsWith('image/') ? document.file_id : undefined);
  if (!fileId) return false;
  const file = await downloadTelegramFile(env, fileId);
  await storeManualImage(env, job, page, file.bytes, document?.file_name ?? file.path);
  await sendMessage(env, chatId, `${page.page_no}페이지 이미지를 받았습니다.`);
  await requestNextManualImage(env, (await getJob(env, job.id)) as JobRow);
  return true;
}
async function handleReply(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.text) return false;
  const chatId = String(message.chat.id);
  const prompt = message.reply_to_message
    ? await env.DB.prepare('SELECT message_id,job_id,purpose FROM telegram_prompts WHERE chat_id=? AND message_id=?').bind(chatId, message.reply_to_message.message_id).first<{ message_id: number; job_id: string; purpose: string }>()
    : await env.DB.prepare('SELECT message_id,job_id,purpose FROM telegram_prompts WHERE chat_id=? ORDER BY created_at DESC LIMIT 1').bind(chatId).first<{ message_id: number; job_id: string; purpose: string }>();
  if (!prompt) return false;
  await env.DB.prepare('DELETE FROM telegram_prompts WHERE chat_id=? AND message_id=?').bind(chatId, prompt.message_id).run();
  if (prompt.purpose === 'edit_copy') await env.JOBS.send({ type: 'draft_copy', jobId: prompt.job_id, instruction: message.text });
  if (prompt.purpose === 'edit_prompts') await env.JOBS.send({ type: 'revise_prompts', jobId: prompt.job_id, instruction: message.text });
  await sendMessage(env, chatId, `수정 요청을 받았습니다 · ${prompt.job_id}\n“${clamp(message.text, 180)}”\n새 초안이 완성되면 다시 보내드릴게요.`);
  return true;
}
async function handleMessage(env: Env, message: TelegramMessage): Promise<void> {
  const chatId = String(message.chat.id);
  const text = (message.text ?? '').trim();
  if (text.startsWith('/claim ')) {
    const existing = await allowedChatId(env);
    if (existing) { await sendMessage(env, chatId, existing === chatId ? '이미 관리자 계정으로 등록되어 있습니다.' : '관리자 등록이 이미 끝났습니다.'); return; }
    const token = text.slice('/claim '.length).trim();
    if (!env.SETUP_TOKEN || token !== env.SETUP_TOKEN) { await sendMessage(env, chatId, '설정 토큰이 올바르지 않습니다.'); return; }
    await setSetting(env, 'admin_chat_id', chatId);
    await sendMessage(env, chatId, '관리자 Telegram 계정 등록이 끝났습니다. /new로 시작하세요.');
    return;
  }
  if (!(await requireAllowed(env, chatId))) return;
  if (await handleChatGptJsonDocument(env, message)) return;
  if (await handleManualImageAttachment(env, message)) return;
  const command = text.split(/\s+/)[0].toLowerCase();
  if (command === '/new' || command === '/새카드뉴스') return showReports(env, chatId, 'chatgpt');
  if (command === '/legacy') return showReports(env, chatId, 'legacy');
  if (command === '/jobs' || command === '/작업') return showJobs(env, chatId);
  if (command === '/retry' || command === '/재시도') {
    const job = await latestRecoverableJob(env, chatId);
    if (!job) { await sendMessage(env, chatId, '다시 실행할 수 있는 작업이 없습니다. /new로 새 작업을 시작하세요.'); return; }
    if (await enqueueMissingImages(env, job)) {
      await sendMessage(env, chatId, `빠진 이미지 후보를 이어서 생성합니다 · ${job.id}\n무료 할당량 오류였다면 초기화 시각 이후 /retry를 눌러 주세요.`);
      return;
    }
    const task: QueueTask = isVisualRecovery(job) ? { type: 'draft_visuals', jobId: job.id } : { type: 'draft_copy', jobId: job.id };
    await env.JOBS.send(task);
    await sendMessage(env, chatId, `작업을 이어서 다시 실행합니다 · ${job.id}\n무료 할당량 오류였다면 초기화 시각 이후 /retry를 눌러 주세요.`);
    return;
  }
  if (await handleReply(env, message)) return;
  if (text && !text.startsWith('/') && text.length >= 4) {
    const job = await latestRecoverableJob(env, chatId);
    if (job) {
      const task: QueueTask = isVisualRecovery(job)
        ? { type: 'revise_prompts', jobId: job.id, instruction: text }
        : { type: 'draft_copy', jobId: job.id, instruction: text };
      await env.JOBS.send(task);
      await sendMessage(env, chatId, `자연어 수정 요청을 반영해 ${task.type === 'revise_prompts' ? '이미지 계획' : '문안'}을 다시 작성합니다.\n작업: ${job.id}`);
      return;
    }
  }
  await sendMessage(env, chatId, '사용법\n/new — ChatGPT 작업용 published HTML 선택\n/jobs — 최근 작업 확인\n/legacy — 기존 무료 AI 경로\n\n수정 요청 버튼을 누른 뒤, 열린 입력창이나 다음 메시지에 수정 내용을 보내세요.');
}
async function handleCallback(env: Env, query: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
  const chatId = String(query.message?.chat.id ?? query.from.id);
  if (!(await requireAllowed(env, chatId))) return;
  await answerCallback(env, query.id);
  const [action, id, pageRaw] = (query.data ?? '').split(':');
  if (action === 'hg') {
    const job = await getJob(env, id);
    if (!job || job.chat_id !== chatId) { await sendMessage(env, chatId, '작업을 찾지 못했습니다.'); return; }
    await updateJob(env, id, { status: 'CHATGPT_DRAFTING', last_error: null });
    await env.JOBS.send({ type: 'dispatch_parse', jobId: id });
    await sendMessage(env, chatId, `Git 원본 HTML을 확인하고 ChatGPT 작업 패킷을 준비합니다.\n작업: ${id}`);
    return;
  }
  if (action === 'hs') {
    const choice = await env.DB.prepare('SELECT source_path FROM file_choices WHERE choice_id=? AND chat_id=?').bind(id, chatId).first<{ source_path: string }>();
    if (!choice) { await sendMessage(env, chatId, '선택 항목이 만료됐습니다. /new를 다시 실행하세요.'); return; }
    const jobId = shortId(12);
    await env.DB.prepare("INSERT INTO jobs(id,chat_id,source_path,status) VALUES(?,?,?,'CHATGPT_DRAFTING')").bind(jobId, chatId, choice.source_path).run();
    await env.JOBS.send({ type: 'dispatch_parse', jobId });
    await sendMessage(env, chatId, `선택한 Git 리포트의 ChatGPT 작업 패킷을 준비합니다 · ${jobId}\n${fileName(choice.source_path)}`);
    return;
  }
  if (action === 'fs') {
    const choice = await env.DB.prepare('SELECT source_path FROM file_choices WHERE choice_id=? AND chat_id=?').bind(id, chatId).first<{ source_path: string }>();
    if (!choice) { await sendMessage(env, chatId, '선택 항목이 만료됐습니다. /new를 다시 실행하세요.'); return; }
    const jobId = shortId(12);
    await env.DB.prepare("INSERT INTO jobs(id,chat_id,source_path,status) VALUES(?,?,?,'SELECTED')").bind(jobId, chatId, choice.source_path).run();
    await env.JOBS.send({ type: 'dispatch_parse', jobId });
    await sendMessage(env, chatId, `작업을 시작했습니다 · ${jobId}\n${fileName(choice.source_path)}`);
    return;
  }
  const job = await getJob(env, id);
  if (!job || job.chat_id !== chatId) { await sendMessage(env, chatId, '작업을 찾지 못했습니다.'); return; }
  if (action === 'ca') {
    await updateJob(env, id, { status: 'COPY_APPROVED', last_error: null });
    await env.JOBS.send({ type: 'draft_visuals', jobId: id });
    await sendMessage(env, chatId, `문구를 승인했습니다 · ${id}\n이미지 계획을 별도 단계로 작성합니다. 완료되면 다시 알려드리겠습니다.`);
    return;
  }
  if (action === 'mu') {
    await updateJob(env, id, { status: 'MANUAL_IMAGE_UPLOADING', last_error: null });
    await requestNextManualImage(env, (await getJob(env, id)) as JobRow);
    return;
  }
  if (action === 'me') {
    await registerAttachmentRequest(env, chatId, id, 'import_chatgpt_json', `ChatGPT에서 수정한 최종 JSON 파일을 이 채팅에 첨부하세요.\n작업: ${id}`);
    return;
  }
  if (action === 'ce') { await registerReply(env, chatId, id, 'edit_copy', `아래 입력창에 수정 내용을 한 번에 적어 보내주세요. 이 메시지에 답장해도 되고, 그냥 다음 메시지로 보내도 됩니다.\n\n페이지별 요청과 전체 요청을 함께 쓸 수 있어요.\n예: 표지는 한 문장으로 줄이고, 본문 1은 표지와 겹치지 않게 배경 설명으로 바꿔줘. 전체 본문은 페이지당 2~3문장으로 줄여줘.\n\n작업: ${id}`); return; }
  if (action === 'cr') { await env.JOBS.send({ type: 'draft_copy', jobId: id, instruction: '기존 초안과 다른 구조로 전체를 다시 작성하라.' }); await sendMessage(env, chatId, '문구를 다시 생성합니다.'); return; }
  if (action === 'pe') { await registerReply(env, chatId, id, 'edit_prompts', `이미지 계획 수정사항을 이 메시지에 답장하세요.\n예: 실사 위주로 바꾸고 4페이지는 건물 없이 자연스러운 일러스트로 표현해줘.\n작업: ${id}`); return; }
  if (action === 'pa') {
    const pages = (await getPages(env, id)).filter((p) => p.image_required);
    await env.DB.batch(pages.map((page) => env.DB.prepare(`UPDATE pages SET image_a_key=NULL,image_b_key=NULL,selected_key=NULL,qa_a_json=NULL,qa_b_json=NULL,status='IMAGE_GENERATING',updated_at=? WHERE job_id=? AND page_no=?`).bind(now(), id, page.page_no)));
    await updateJob(env, id, { status: 'IMAGE_GENERATING', last_error: null, final_pptx_key: null, final_zip_key: null, pptx_sent: 0, zip_sent: 0, final_notice_sent: 0 });
    for (const page of pages) {
      await env.JOBS.send({ type: 'generate_image', jobId: id, pageNo: page.page_no, variant: 'a' });
      await env.JOBS.send({ type: 'generate_image', jobId: id, pageNo: page.page_no, variant: 'b' });
    }
    await sendMessage(env, chatId, `이미지 ${pages.length}페이지 × 2안을 생성합니다.\n페이지별 결과가 준비되는 즉시 순서대로 보내드리겠습니다.`);
    return;
  }
  if (action === 'ia' || action === 'ib') {
    const pageNo = Number(pageRaw);
    const page = await env.DB.prepare('SELECT * FROM pages WHERE job_id=? AND page_no=?').bind(id, pageNo).first<PageRow>();
    const selected = action === 'ia' ? page?.image_a_key : page?.image_b_key;
    if (!selected) { await sendMessage(env, chatId, '선택할 이미지가 없습니다.'); return; }
    await env.DB.prepare("UPDATE pages SET selected_key=?,status='IMAGE_SELECTED',updated_at=? WHERE job_id=? AND page_no=?").bind(selected, now(), id, pageNo).run();
    await sendMessage(env, chatId, `${pageNo}페이지 ${action === 'ia' ? 'A' : 'B'}를 선택했습니다.`);
    await maybeRender(env, (await getJob(env, id)) as JobRow);
    return;
  }
  if (action === 'ir') {
    const pageNo = Number(pageRaw); const nonce = shortId(6);
    await env.DB.prepare(`UPDATE pages SET image_a_key=NULL,image_b_key=NULL,selected_key=NULL,qa_a_json=NULL,qa_b_json=NULL,status='IMAGE_GENERATING',updated_at=? WHERE job_id=? AND page_no=?`).bind(now(), id, pageNo).run();
    await updateJob(env, id, { status: 'IMAGE_GENERATING' });
    await env.JOBS.send({ type: 'generate_image', jobId: id, pageNo, variant: 'a', nonce });
    await env.JOBS.send({ type: 'generate_image', jobId: id, pageNo, variant: 'b', nonce });
    await sendMessage(env, chatId, `${pageNo}페이지 이미지를 다시 생성합니다.`);
    return;
  }
  if (action === 'fa') { await updateJob(env, id, { status: 'FINAL_APPROVED' }); await sendMessage(env, chatId, `최종 승인 처리했습니다 · ${id}`); return; }
  if (action === 'cx') { await updateJob(env, id, { status: 'CANCELLED' }); await sendMessage(env, chatId, `작업을 취소했습니다 · ${id}`); }
}
async function handleTelegram(env: Env, request: Request): Promise<Response> {
  if (request.headers.get('x-telegram-bot-api-secret-token') !== env.TELEGRAM_WEBHOOK_SECRET) return new Response('unauthorized', { status: 401 });
  const update = await request.json() as TelegramUpdate;
  if (!(await recordEvent(env, `tg:${update.update_id}`, 'telegram_update', update))) return json({ ok: true, duplicate: true });
  if (update.message) await handleMessage(env, update.message);
  if (update.callback_query) await handleCallback(env, update.callback_query);
  return json({ ok: true });
}
async function handleGithubCallback(env: Env, request: Request): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());
  if (!(await verifyHmac(env.CALLBACK_HMAC_SECRET, body, request.headers.get('x-cardnews-signature')))) return new Response('unauthorized', { status: 401 });
  const payload = JSON.parse(new TextDecoder().decode(body)) as CallbackPayload;
  if (!(await recordEvent(env, `cb:${payload.event_id}`, `callback:${payload.stage}`, payload, payload.job_id))) return json({ ok: true, duplicate: true });
  const job = await getJob(env, payload.job_id);
  if (!job) return json({ error: 'job not found' }, 404);
  if (payload.stage === 'SOURCE_PARSED' && payload.source_key) {
    await updateJob(env, job.id, { source_key: payload.source_key, status: 'SOURCE_PARSED' });
    const refreshed = (await getJob(env, job.id)) as JobRow;
    if (job.status === 'CHATGPT_DRAFTING') {
      await sendChatGptPackage(env, refreshed);
    } else {
      await env.JOBS.send({ type: 'draft_copy', jobId: job.id });
    }
  } else if (payload.stage === 'RENDERED' && payload.pptx_key && payload.zip_key) {
    await updateJob(env, job.id, { status: 'RENDERED', final_pptx_key: payload.pptx_key, final_zip_key: payload.zip_key });
    await env.JOBS.send({ type: 'notify_rendered', jobId: job.id });
  } else if (payload.stage === 'FAILED') {
    await updateJob(env, job.id, { status: 'FAILED_RETRYABLE', last_error: clamp(payload.error ?? 'GitHub Actions 실패', 1500) });
    await sendMessage(env, job.chat_id, `GitHub Actions 실패 · ${job.id}\n${payload.error ?? ''}`);
  }
  return json({ ok: true });
}
async function handleReportPublished(env: Env, request: Request): Promise<Response> {
  const body = new Uint8Array(await request.arrayBuffer());
  if (!(await verifyHmac(env.CALLBACK_HMAC_SECRET, body, request.headers.get('x-cardnews-signature')))) return new Response('unauthorized', { status: 401 });
  const payload = JSON.parse(new TextDecoder().decode(body)) as ReportPublishedPayload;
  if (!/^reports_.*\.html$/i.test(payload.source_path) || /_PREVIEW/i.test(payload.source_path)) return json({ error: 'invalid source path' }, 400);
  const html = await fetchGithubFileText(env, payload.source_path);
  const meta = parseReportMeta(html);
  if (!meta?.published) return json({ ok: true, skipped: 'unpublished' });
  if (!(await recordEvent(env, `report:${payload.event_id}`, 'report_published', payload))) return json({ ok: true, duplicate: true });
  const chatId = await allowedChatId(env);
  if (!chatId) return json({ ok: true, pending_admin_claim: true });
  const jobId = shortId(12);
  await env.DB.prepare("INSERT INTO jobs(id,chat_id,source_path,report_title,report_category,status) VALUES(?,?,?,?,?,'SELECTED')")
    .bind(jobId, chatId, payload.source_path, meta.title ?? fileName(payload.source_path), meta.cat ?? '').run();
  await sendMessage(env, chatId, `새 published 리포트가 Git에 등록됐습니다.\n${meta.title ?? fileName(payload.source_path)}\n\nChatGPT에서 문안·이미지를 만들 작업 패킷을 준비할까요?`, [
    [{ text: 'ChatGPT 작업 패킷 준비', callback_data: `hg:${jobId}` }],
    [{ text: '나중에', callback_data: `cx:${jobId}` }],
  ]);
  return json({ ok: true, job_id: jobId });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'srcplus-cardnews' });
    if (request.method === 'POST' && url.pathname === '/telegram') return handleTelegram(env, request);
    if (request.method === 'POST' && url.pathname === '/api/callback') return handleGithubCallback(env, request);
    if (request.method === 'POST' && url.pathname === '/api/report-published') return handleReportPublished(env, request);
    return new Response('not found', { status: 404 });
  },
  async queue(batch: MessageBatch<QueueTask>, env: Env): Promise<void> { await handleQueue(batch, env); },
} satisfies ExportedHandler<Env, QueueTask>;
