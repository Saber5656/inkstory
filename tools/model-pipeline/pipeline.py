#!/usr/bin/env python3
"""Reproducible, offline pose model checks. Never imported by the web app."""
from __future__ import annotations
import argparse, hashlib, json, sys, urllib.request, zipfile
from pathlib import Path

SOURCE_URL = "https://github.com/facebookresearch/AnimatedDrawings/releases/download/v0.0.1/drawn_humanoid_pose_estimator.mar"
SOURCE_SHA256 = "40ebdc69f1727dfe475161ae751fb066013e590f8894fe0016f0b69b336ee42f"
SOURCE_SIZE = 374_824_711
CONFIG_SHA256 = "fa2d2ad1ae6fd94b7d46a75526848471a3728c382efcb36c5a9814d44bcc669e"
MAR_MANIFEST_SHA256 = "48f8d69f14f5f32b1a70e5d75a83ac379a2a5f92c36e8e19679a7e294f9e63be"
REPO_ROOT = Path(__file__).resolve().parents[2]

def sha256_bytes(data: bytes) -> str: return hashlib.sha256(data).hexdigest()
def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024): digest.update(chunk)
    return digest.hexdigest()

def download(destination: Path) -> dict[str, object]:
    destination.parent.mkdir(parents=True, exist_ok=True); digest = hashlib.sha256(); size = 0
    with urllib.request.urlopen(SOURCE_URL, timeout=60) as response, destination.open("wb") as output:
        while chunk := response.read(1024 * 1024): output.write(chunk); digest.update(chunk); size += len(chunk)
    actual = digest.hexdigest()
    if size != SOURCE_SIZE or actual != SOURCE_SHA256: raise RuntimeError(json.dumps({"error": "source-integrity", "expectedSize": SOURCE_SIZE, "actualSize": size, "expectedSha256": SOURCE_SHA256, "actualSha256": actual}))
    return {"path": str(destination), "sizeBytes": size, "sha256": actual}

def inspect(path: Path) -> dict[str, object]:
    with zipfile.ZipFile(path) as archive:
        members = {info.filename: info.file_size for info in archive.infolist()}
        config_hash = sha256_bytes(archive.read("config.py")); mar_manifest_hash = sha256_bytes(archive.read("MAR-INF/MANIFEST.json"))
    return {"source": {"url": SOURCE_URL, "sha256": SOURCE_SHA256, "sizeBytes": SOURCE_SIZE}, "archive": {"path": str(path), "sizeBytes": path.stat().st_size, "sha256": sha256_file(path), "members": members, "configSha256": config_hash, "marManifestSha256": mar_manifest_hash}, "integrity": config_hash == CONFIG_SHA256 and mar_manifest_hash == MAR_MANIFEST_SHA256, "conversionAttempted": False}

def manifest_check() -> dict[str, object]:
    manifest_path = REPO_ROOT / "src/pose/modelManifest.generated.json"; value = json.loads(manifest_path.read_text())
    required = {"id", "status", "file", "sha256", "sizeBytes", "inputWidth", "inputHeight", "normalization", "outputSpec", "license", "provenance"}; present = required.issubset(value); provenance = value.get("provenance", {})
    pinned = isinstance(provenance.get("sourceUrl"), str) and "/releases/download/v0.0.1/" in provenance["sourceUrl"] and provenance.get("sourceSha256") == SOURCE_SHA256
    return {"path": str(manifest_path), "requiredFields": present, "status": value.get("status"), "pinnedProvenance": pinned, "valid": present and pinned}

def main() -> int:
    parser = argparse.ArgumentParser(); subparsers = parser.add_subparsers(dest="command", required=True)
    inspect_parser = subparsers.add_parser("inspect"); inspect_parser.add_argument("--download-dir", type=Path, required=True)
    verify_parser = subparsers.add_parser("verify"); verify_parser.add_argument("--archive", type=Path)
    subparsers.add_parser("convert"); args = parser.parse_args()
    if args.command == "convert":
        print(json.dumps({"status": "blocked", "reason": "dependency-resolution", "observed": "uv pip install --dry-run with CPython 3.11.16 arm64 and torch==2.0.1 mmpose==1.0.0 mmdeploy==1.3.1 onnx==1.14.1 has no solution: mmdeploy 1.3.1 publishes manylinux2014_x86_64 and win_amd64 wheels, no macosx arm64 wheel", "archiveSizeBytes": SOURCE_SIZE, "archiveExceedsSizeTarget": True, "nextStep": "repeat with a pinned x86_64/Linux conversion environment or an audited replacement model; export and measure ONNX size before deciding availability"}, indent=2)); return 2
    if args.command == "verify":
        report: dict[str, object] = {"manifest": manifest_check(), "source": {"url": SOURCE_URL, "sha256": SOURCE_SHA256, "sizeBytes": SOURCE_SIZE}}
        if args.archive:
            archive_report = inspect(args.archive); archive_report["sourceHashMatches"] = archive_report["archive"]["sha256"] == SOURCE_SHA256; archive_report["sourceSizeMatches"] = archive_report["archive"]["sizeBytes"] == SOURCE_SIZE; report["archive"] = archive_report
        report["valid"] = bool(report["manifest"]["valid"]) and (not args.archive or bool(report["archive"]["integrity"]) and bool(report["archive"]["sourceHashMatches"]) and bool(report["archive"]["sourceSizeMatches"]))
        print(json.dumps(report, indent=2)); return 0 if report["valid"] else 1
    archive = args.download_dir / "drawn_humanoid_pose_estimator.mar"; result = download(archive); result["inspection"] = inspect(archive); print(json.dumps(result, indent=2)); return 0

if __name__ == "__main__": sys.exit(main())
