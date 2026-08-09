PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  source_key TEXT,
  report_title TEXT,
  report_category TEXT,
  status TEXT NOT NULL,
  copy_version INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER NOT NULL DEFAULT 0,
  render_manifest_key TEXT,
  final_pptx_key TEXT,
  final_zip_key TEXT,
  pptx_sent INTEGER NOT NULL DEFAULT 0,
  zip_sent INTEGER NOT NULL DEFAULT 0,
  final_notice_sent INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_chat_created ON jobs(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);

CREATE TABLE IF NOT EXISTS pages (
  job_id TEXT NOT NULL,
  page_no INTEGER NOT NULL,
  page_kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visual_style TEXT NOT NULL DEFAULT 'photo',
  visual_brief_ko TEXT NOT NULL DEFAULT '',
  visual_prompt TEXT NOT NULL DEFAULT '',
  image_required INTEGER NOT NULL DEFAULT 1,
  reuse_page_no INTEGER,
  image_a_key TEXT,
  image_b_key TEXT,
  selected_key TEXT,
  qa_a_json TEXT,
  qa_b_json TEXT,
  status TEXT NOT NULL DEFAULT 'COPY_DRAFTED',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(job_id, page_no),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS file_choices (
  choice_id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_choices_chat_created ON file_choices(chat_id, created_at DESC);

CREATE TABLE IF NOT EXISTS telegram_prompts (
  chat_id TEXT NOT NULL,
  message_id INTEGER NOT NULL,
  job_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  page_no INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(chat_id, message_id),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
