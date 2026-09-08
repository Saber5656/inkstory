#!/usr/bin/env python3
"""Reproducible, offline pose model spike checks (never imported by the web app)."""
from __future__ import annotations
import argparse, hashlib, json, sys, urllib.request, zipfile
from pathlib import Path

SOURCE_URL = "https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar"
SOURCE_SHA256 = "40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f"
SOURCE_SIZE = 374_824_711
MAX_ARTIFACT_BYTES = 60 * 1024 * 1024

def download(destination: Path) -> dict[str, object]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(); size = 0
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024):
            output.write(chunk); digest.update(chunk); size += len(chunk)
    actual = digest.hexdigest()
    if size != SOURCE_SIZE or actual != SOURCE_SHA256:
        raise RuntimeError(json.dumps({"error": "source-integrity", "expectedSize": SOURCE_SIZE, "actualSize": size, "expectedSha256": SOURCE_SHA256, "actualSha256": actual}))
    return {"path": str(destination), "sizeBytes": size, "sha256": actual}

def inspect(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        members = [{"name": info.filename, "sizeBytes": info.file_size} for info in archive.infolist()]
    return {"source": {"url": SOURCE_URL, "sha256": SOURCE_SHA256, "sizeBytes": SOURCE_SIZE}, "members": members, "hardCapBytes": MAX_ARTIFACT_BYTES, "convertible": False, "blocker": "upstream MAR exceeds 60MB hard cap; pinned PyTorch/MMDeploy conversion environment is unavailable"}

def main() -> int:
    parser = argparse.ArgumentParser(); subparsers = parser.add_subparsers(dest="command", required=True)
    inspect_parser = subparsers.add_parser("inspect"); inspect_parser.add_argument("--download-dir", type=Path, required=True)
    subparsers.add_parser("verify"); subparsers.add_parser("convert")
    args = parser.parse_args()
    if args.command == "verify":
        print(json.dumps({"status": "unavailable", "reason": "upstream MAR is 374824711 bytes; hard cap is 62914560", "sourceUrl": SOURCE_URL, "sourceSha256": SOURCE_SHA256}, indent=2)); return 0
    if args.command == "convert":
        print(json.dumps({"status": "blocked", "reason": "upstream MAR exceeds 60MB hard cap; install a pinned conversion environment and evaluate a smaller exported graph", "required": ["torch", "mmpose", "mmdeploy", "onnx"]}, indent=2)); return 2
    archive = args.download_dir / "drawn_humanoid_pose_estimator.mar"; result = download(archive); result["inspection"] = inspect(archive); print(json.dumps(result, indent=2)); return 0

if __name__ == "__main__": sys.exit(main())
