#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import urllib.request
import uuid


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", required=True)
    parser.add_argument("--stage", required=True, choices=["SOURCE_PARSED", "RENDERED", "FAILED"])
    parser.add_argument("--source-key")
    parser.add_argument("--pptx-key")
    parser.add_argument("--zip-key")
    parser.add_argument("--error")
    args = parser.parse_args()
    payload = {"event_id": str(uuid.uuid4()), "job_id": args.job_id, "stage": args.stage}
    for key, value in {"source_key": args.source_key, "pptx_key": args.pptx_key, "zip_key": args.zip_key, "error": args.error}.items():
        if value:
            payload[key] = value
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
    signature = hmac.new(os.environ["CALLBACK_HMAC_SECRET"].encode(), body, hashlib.sha256).hexdigest()
    request = urllib.request.Request(
        os.environ["WORKER_CALLBACK_URL"], data=body, method="POST",
        headers={"content-type": "application/json", "x-cardnews-signature": f"sha256={signature}"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        print(response.status, response.read().decode())


if __name__ == "__main__":
    main()
