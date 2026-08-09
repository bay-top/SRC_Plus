import editorialRules from '../config/editorial.json';

type JobStatus =
  | 'SELECTED' | 'PARSING' | 'SOURCE_PARSED' | 'COPY_DRAFTING' | 'COPY_DRAFTED'
  | 'COPY_APPROVED' | 'IMAGE_GENERATING' | 'IMAGES_GENERATED' | 'RENDERING'
  | 'RENDERED' | 'FINAL_APPROVED' | 'FAILED_RETRYABLE' | 'FAILED_FINAL' | 'CANCELLED';

type QueueTask =
  | { type: 'dispatch_parse'; jobId: string }
  | { type: 'draft_copy'; jobId: string; instruction?: string }
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
  TEXT_MODEL: string;
  IMAGE_MODEL: string;
  VISION_MODEL: string;
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
  'Editorial stock photography aesthetic, natural and visually credible.',
  'Realistic materials, plausible architecture, restrained color grading and natural light.',
  'Unposed composition with one clear focal point, vertical 3:4.',
  'Keep the lower portion calm and suitable for a dark text overlay.',
  'No readable text, letters, numbers, captions, labels, company logos, trademarks, brand marks, signage, product labels or watermarks.',
  'No recognizable company-specific storefront or corporate identity.',
  'No impossible geometry, duplicated structures, glossy plastic render, extreme HDR, neon glow or cinematic fog.',
].join(' ');
const IMAGE_POLICY_ILLUSTRATION = [
  'Natural editorial illustration with restrained composition and subtle tactile texture.',
  'Muted sophisticated colors, conceptually clear but not infographic-like, vertical 3:4.',
  'Keep the lower portion calm and suitable for a dark text overlay.',
  'No text, letters, numbers, captions, company logos, trademarks, signage or watermarks.',
  'No glossy plastic 3D render, game concept art, neon gradients or corporate brand identity.',
].join(' ');

function now(): string { return new Date().toISOString(); }
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
async function answerCallback(env: Env, id: string, text = '처리 중'): Promise<void> {
  await telegramCall(env, 'answerCallbackQuery', JSON.stringify({ callback_query_id: id, text }), { 'content-type': 'application/json' });
}
async function registerReply(env: Env, chatId: string, jobId: string, purpose: string, text: string): Promise<void> {
  const message = await sendMessage(env, chatId, text, undefined, true);
  await env.DB.prepare('INSERT OR REPLACE INTO telegram_prompts(chat_id,message_id,job_id,purpose) VALUES(?,?,?,?)')
    .bind(chatId, message.message_id, jobId, purpose).run();
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

function draftSchema(): Record<string, unknown> {
  const { limits } = editorialRules;
  const visualProperties = {
    visual_style: { type: 'string', enum: ['photo', 'illustration'] },
    visual_brief_ko: { type: 'string' },
    visual_prompt: { type: 'string' },
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

function ensureKorean(value: string, field: string): string {
  const text = value.trim();
  if (!/[가-힣]/.test(text)) throw new Error(`${field}에 한국어가 없습니다.`);
  return text;
}
function validateVisualPrompt(value: string): string {
  const prompt = clamp(value.trim(), 1300);
  if (!prompt) throw new Error('빈 이미지 프롬프트가 생성됐습니다.');
  if (/[가-힣]/.test(prompt)) throw new Error('이미지 프롬프트에 한국어가 포함됐습니다. 다시 생성합니다.');
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
function normalizeDraft(raw: AiDraft): AiDraft {
  const { limits, structure } = editorialRules;
  if (!raw?.cover || !Array.isArray(raw.body_pages) || raw.body_pages.length < structure.body_pages_min || raw.body_pages.length > structure.body_pages_max) throw new Error('AI 카드 구조가 유효하지 않습니다.');
  const cover = {
    title: clamp(ensureKorean(String(raw.cover.title ?? ''), '표지 제목'), limits.cover_title_max_chars),
    subtitle: clamp(ensureKorean(String(raw.cover.subtitle ?? ''), '표지 부제'), limits.cover_subtitle_max_chars),
    visual_style: raw.cover.visual_style === 'illustration' ? 'illustration' as const : 'photo' as const,
    visual_brief_ko: clamp(String(raw.cover.visual_brief_ko ?? '').trim(), 280),
    visual_prompt: validateVisualPrompt(String(raw.cover.visual_prompt ?? '')),
  };
  const bodyPages = raw.body_pages.map((page) => ({
    title: clamp(ensureKorean(String(page.title ?? ''), '본문 제목'), limits.body_title_max_chars),
    body: clamp(ensureKorean(String(page.body ?? ''), '본문'), limits.body_max_chars),
    visual_style: page.visual_style === 'illustration' ? 'illustration' as const : 'photo' as const,
    visual_brief_ko: clamp(String(page.visual_brief_ko ?? '').trim(), 280),
    visual_prompt: validateVisualPrompt(String(page.visual_prompt ?? '')),
  }));
  if (!cover.title || !cover.subtitle || !cover.visual_brief_ko || bodyPages.some((p) => !p.title || !p.body || !p.visual_brief_ko)) throw new Error('AI가 빈 카드 필드를 반환했습니다.');
  if (cover.subtitle.length < limits.cover_subtitle_min_chars) throw new Error('표지 부제가 너무 짧습니다. 다시 생성합니다.');
  assertDifferent(cover.title, cover.subtitle, '표지 제목과 부제');
  for (const [index, page] of bodyPages.entries()) {
    if (page.title.length < limits.body_title_min_chars || page.body.length < limits.body_min_chars) throw new Error(`본문 ${index + 1}의 정보량이 카드 규격에 맞지 않습니다. 다시 생성합니다.`);
    const sentences = sentenceCount(page.body);
    if (sentences < limits.body_sentences_min || sentences > limits.body_sentences_max) throw new Error(`본문 ${index + 1}의 문장 수가 카드 규격에 맞지 않습니다. 다시 생성합니다.`);
    assertDifferent(page.title, page.body, `본문 ${index + 1}의 제목과 내용`);
    assertDifferent(cover.title, page.title, `표지와 본문 ${index + 1} 제목`);
  }
  if (new Set(bodyPages.map((page) => comparable(page.title))).size !== bodyPages.length) throw new Error('본문 제목이 서로 중복됐습니다. 다시 생성합니다.');
  return {
    report_title: clamp(String(raw.report_title ?? cover.title).trim(), 120),
    category: ['insights', 'issues', 'sectors'].includes(raw.category) ? raw.category : 'issues',
    cover,
    body_pages: bodyPages,
    cta_subject: clamp(ensureKorean(String(raw.cta_subject ?? '').replace(/에 대한$/, ''), '안내 문구 주제'), limits.cta_subject_max_chars),
  };
}
async function createDraft(env: Env, source: unknown, previous: PageRow[], instruction?: string): Promise<AiDraft> {
  const system = `당신은 SRC Plus의 한국어 인스타그램 카드뉴스 편집자다.
다음 중앙 편집 규칙 JSON을 최초 생성, 수정, 전체 재생성에 예외 없이 적용한다.
examples.good은 형식과 톤만 참고하고 그 주제·사실·수치·표현을 복사하지 않는다. examples.bad의 패턴은 만들지 않는다.
${JSON.stringify(editorialRules, null, 2)}
visual_brief_ko는 사용자가 검토할 한국어 이미지 설명이다.
visual_prompt는 이미지 모델용 영어만 사용한다. 특정 기업명·브랜드명·로고·간판·제품명을 넣지 말고, 기업 사례는 일반적인 산업·공간 장면으로 바꾼다.
실제 장면이 자연스러우면 photo를 우선하고, 개념 관계를 사진으로 표현하기 어려울 때만 illustration을 사용한다.
이미지 안에 글자, 숫자, 로고, 워터마크, 간판이 없어야 하며 아래쪽은 카드 텍스트를 놓기 쉬운 단순한 구도로 둔다.`;
  const baseUser = `구조화된 리포트 JSON:\n${clamp(JSON.stringify(source), 42000)}\n\n현재 초안:\n${previous.length ? clamp(JSON.stringify(previous.map((p) => ({ page_no: p.page_no, page_kind: p.page_kind, title: p.title, body: p.body, visual_style: p.visual_style, visual_brief_ko: p.visual_brief_ko, visual_prompt: p.visual_prompt }))), 18000) : '없음'}\n\n수정 지시:\n${instruction ?? '새 카드뉴스 초안을 작성하라.'}`;
  let correction = '';
  let lastError = 'Workers AI가 유효한 카드뉴스를 반환하지 않았습니다.';
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const user = `${baseUser}${correction ? `\n\n직전 응답의 검증 실패:\n${correction}\n중앙 규칙을 다시 확인하고 모든 필드를 처음부터 교정하라.` : ''}`;
    const result = await env.AI.run(env.TEXT_MODEL, {
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: attempt === 1 ? 0.2 : 0.1,
      max_tokens: 4000,
      response_format: { type: 'json_schema', json_schema: draftSchema() },
    }) as { response?: AiDraft };
    if (!result.response) {
      correction = '구조화 응답이 비어 있습니다.';
      lastError = correction;
      continue;
    }
    try {
      return normalizeDraft(result.response);
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      correction = `${lastError}\n직전 응답: ${clamp(JSON.stringify(result.response), 12000)}`;
    }
  }
  throw new Error(`AI 초안 자동 교정 실패: ${lastError}`);
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
async function revisePrompts(env: Env, pages: PageRow[], instruction: string): Promise<void> {
  const targets = pages.filter((p) => p.image_required);
  const schema = {
    type: 'object', properties: { pages: { type: 'array', minItems: targets.length, maxItems: targets.length, items: {
      type: 'object', properties: { page_no: { type: 'integer' }, visual_style: { type: 'string', enum: ['photo', 'illustration'] }, visual_brief_ko: { type: 'string' }, visual_prompt: { type: 'string' } }, required: ['page_no', 'visual_style', 'visual_brief_ko', 'visual_prompt'],
    } } }, required: ['pages'],
  };
  const result = await env.AI.run(env.TEXT_MODEL, {
    messages: [
      { role: 'system', content: '이미지 계획만 수정한다. visual_brief_ko는 한국어, visual_prompt는 영어다. 특정 기업명과 브랜드를 일반적인 산업 장면으로 바꾸고 이미지 내부 글자·숫자·로고·간판·워터마크를 금지한다.' },
      { role: 'user', content: `현재 페이지: ${JSON.stringify(targets.map((p) => ({ page_no: p.page_no, title: p.title, body: p.body, visual_style: p.visual_style, visual_brief_ko: p.visual_brief_ko, visual_prompt: p.visual_prompt })))}\n수정 지시: ${instruction}` },
    ],
    temperature: 0.2, max_tokens: 2600, response_format: { type: 'json_schema', json_schema: schema },
  }) as { response?: { pages: Array<{ page_no: number; visual_style: string; visual_brief_ko: string; visual_prompt: string }> } };
  if (!result.response?.pages || result.response.pages.length !== targets.length) throw new Error('이미지 프롬프트 수정 결과가 유효하지 않습니다.');
  const statements = result.response.pages.map((page) => env.DB.prepare(`UPDATE pages SET visual_style=?,visual_brief_ko=?,visual_prompt=?,image_a_key=NULL,image_b_key=NULL,selected_key=NULL,qa_a_json=NULL,qa_b_json=NULL,status='COPY_DRAFTED',updated_at=? WHERE job_id=? AND page_no=?`)
    .bind(page.visual_style === 'illustration' ? 'illustration' : 'photo', clamp(page.visual_brief_ko.trim(), 280), validateVisualPrompt(page.visual_prompt), now(), targets[0].job_id, page.page_no));
  await env.DB.batch(statements);
}
async function generateImage(env: Env, page: PageRow, seed: number): Promise<Uint8Array> {
  const policy = page.visual_style === 'illustration' ? IMAGE_POLICY_ILLUSTRATION : IMAGE_POLICY_PHOTO;
  const form = new FormData();
  form.append('prompt', `${policy} Subject and scene: ${page.visual_prompt}`);
  form.append('width', env.IMAGE_WIDTH || '768');
  form.append('height', env.IMAGE_HEIGHT || '1024');
  form.append('guidance', '4');
  form.append('seed', String(seed));
  const serialized = new Response(form);
  const result = await env.AI.run(env.IMAGE_MODEL, { multipart: { body: serialized.body, contentType: serialized.headers.get('content-type') } }) as { image?: string };
  if (!result.image) throw new Error('이미지 모델이 이미지를 반환하지 않았습니다.');
  return base64ToBytes(result.image);
}
async function assessImage(env: Env, image: Uint8Array): Promise<Record<string, unknown>> {
  if ((env.VISION_QA_MODE || 'off') === 'off') return { mode: 'off' };
  const schema = { type: 'object', properties: {
    has_readable_text: { type: 'boolean' }, has_logo_or_brand: { type: 'boolean' }, has_watermark: { type: 'boolean' }, obvious_ai_artifacts: { type: 'boolean' }, composition_fit: { type: 'boolean' }, notes_ko: { type: 'string' },
  }, required: ['has_readable_text', 'has_logo_or_brand', 'has_watermark', 'obvious_ai_artifacts', 'composition_fit', 'notes_ko'] };
  try {
    const result = await env.AI.run(env.VISION_MODEL, {
      messages: [
        { role: 'system', content: '카드뉴스 배경 이미지 QA다. 실제로 보이는 요소만 판단하고 한국어로 짧게 메모한다.' },
        { role: 'user', content: '이미지에 읽을 수 있는 글자·숫자·간판, 기업 로고·브랜드, 워터마크, 명백한 AI 왜곡이 있는지와 3:4 카드 하단 텍스트 오버레이에 적합한지 검사하라.' },
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
    return flags.length ? `주의: ${flags.join(', ')} · ${String(qa.notes_ko ?? '')}` : `자동 QA 양호 · ${String(qa.notes_ko ?? '')}`;
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
    return { page_no: page.page_no, page_kind: page.page_kind, title: page.title, body: page.body, image_key: imageKey, reuse_page_no: page.reuse_page_no };
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
  if (task.type === 'dispatch_parse') {
    await updateJob(env, job.id, { status: 'PARSING', last_error: null });
    await dispatchGithub(env, 'parse', job.id, job.source_path);
    return;
  }
  if (task.type === 'draft_copy') {
    await updateJob(env, job.id, { status: 'COPY_DRAFTING', last_error: null });
    const sourceObject = await env.ASSETS.get(job.source_key ?? `jobs/${job.id}/source.json`);
    if (!sourceObject) throw new Error('파싱된 원문 JSON을 찾지 못했습니다.');
    const source = JSON.parse(new TextDecoder().decode(await sourceObject.arrayBuffer())) as unknown;
    const draft = await createDraft(env, source, await getPages(env, job.id), task.instruction);
    await replacePages(env, job.id, draft);
    await sendCopyReview(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  if (task.type === 'revise_prompts') {
    await revisePrompts(env, await getPages(env, job.id), task.instruction);
    await sendPromptReview(env, (await getJob(env, job.id)) as JobRow);
    return;
  }
  if (task.type === 'generate_image') {
    const page = await env.DB.prepare('SELECT * FROM pages WHERE job_id=? AND page_no=?').bind(job.id, task.pageNo).first<PageRow>();
    if (!page || !page.image_required) throw new Error('이미지 생성 대상 페이지가 아닙니다.');
    const bytes = await generateImage(env, page, seedFor(job.id, page.page_no, task.variant, task.nonce));
    const qa = await assessImage(env, bytes);
    const key = `jobs/${job.id}/images/page-${String(page.page_no).padStart(2, '0')}-${task.variant}-${task.nonce ?? 'initial'}.png`;
    await env.ASSETS.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
    const column = task.variant === 'a' ? 'image_a_key' : 'image_b_key';
    const qaColumn = task.variant === 'a' ? 'qa_a_json' : 'qa_b_json';
    await env.DB.prepare(`UPDATE pages SET ${column}=?,${qaColumn}=?,status='IMAGE_GENERATING',updated_at=? WHERE job_id=? AND page_no=?`).bind(key, JSON.stringify(qa), now(), job.id, page.page_no).run();
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
      if (message.attempts >= 3) {
        await markFailure(env, message.body.jobId, error);
        const job = await getJob(env, message.body.jobId);
        if (job) await sendMessage(env, job.chat_id, `작업 실패 · ${job.id}\n${error instanceof Error ? error.message : String(error)}`);
        message.ack();
      } else message.retry({ delaySeconds: Math.min(60, message.attempts * 8) });
    }
  }
}

async function showReports(env: Env, chatId: string): Promise<void> {
  const reports = (await listReports(env)).slice(0, 16);
  if (!reports.length) { await sendMessage(env, chatId, 'published=true인 최종 리포트를 찾지 못했습니다.'); return; }
  await env.DB.prepare("DELETE FROM file_choices WHERE created_at < datetime('now','-1 day')").run();
  const choices = reports.map((report) => ({ ...report, id: shortId(10) }));
  await env.DB.batch(choices.map((choice) => env.DB.prepare('INSERT INTO file_choices(choice_id,chat_id,source_path) VALUES(?,?,?)').bind(choice.id, chatId, choice.path)));
  await sendMessage(env, chatId, '카드뉴스로 만들 리포트를 선택하세요.', choices.map((choice) => [{ text: `${choice.date} · ${clamp(choice.title, 42)}`, callback_data: `fs:${choice.id}` }]));
}
async function showJobs(env: Env, chatId: string): Promise<void> {
  const result = await env.DB.prepare('SELECT * FROM jobs WHERE chat_id=? ORDER BY created_at DESC LIMIT 10').bind(chatId).all<JobRow>();
  if (!result.results.length) { await sendMessage(env, chatId, '아직 생성한 작업이 없습니다.'); return; }
  await sendMessage(env, chatId, result.results.map((job) => `${job.id} · ${job.status}\n${fileName(job.source_path)}${job.last_error ? `\n${clamp(job.last_error, 120)}` : ''}`).join('\n\n'));
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
  const command = text.split(/\s+/)[0].toLowerCase();
  if (command === '/new' || command === '/새카드뉴스') return showReports(env, chatId);
  if (command === '/jobs' || command === '/작업') return showJobs(env, chatId);
  if (await handleReply(env, message)) return;
  await sendMessage(env, chatId, '사용법\n/new — 게시된 HTML 리포트 선택\n/jobs — 최근 작업 확인\n\n수정 요청 버튼을 누른 뒤, 열린 입력창이나 다음 메시지에 수정 내용을 보내세요.');
}
async function handleCallback(env: Env, query: NonNullable<TelegramUpdate['callback_query']>): Promise<void> {
  const chatId = String(query.message?.chat.id ?? query.from.id);
  if (!(await requireAllowed(env, chatId))) return;
  await answerCallback(env, query.id);
  const [action, id, pageRaw] = (query.data ?? '').split(':');
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
  if (action === 'ca') { await updateJob(env, id, { status: 'COPY_APPROVED' }); await sendPromptReview(env, job); return; }
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
    await sendMessage(env, chatId, `이미지 ${pages.length}페이지 × 2안을 생성합니다.`);
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
    await env.JOBS.send({ type: 'draft_copy', jobId: job.id });
  } else if (payload.stage === 'RENDERED' && payload.pptx_key && payload.zip_key) {
    await updateJob(env, job.id, { status: 'RENDERED', final_pptx_key: payload.pptx_key, final_zip_key: payload.zip_key });
    await env.JOBS.send({ type: 'notify_rendered', jobId: job.id });
  } else if (payload.stage === 'FAILED') {
    await updateJob(env, job.id, { status: 'FAILED_RETRYABLE', last_error: clamp(payload.error ?? 'GitHub Actions 실패', 1500) });
    await sendMessage(env, job.chat_id, `GitHub Actions 실패 · ${job.id}\n${payload.error ?? ''}`);
  }
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') return json({ ok: true, service: 'srcplus-cardnews' });
    if (request.method === 'POST' && url.pathname === '/telegram') return handleTelegram(env, request);
    if (request.method === 'POST' && url.pathname === '/api/callback') return handleGithubCallback(env, request);
    return new Response('not found', { status: 404 });
  },
  async queue(batch: MessageBatch<QueueTask>, env: Env): Promise<void> { await handleQueue(batch, env); },
} satisfies ExportedHandler<Env, QueueTask>;
