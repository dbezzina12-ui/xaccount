"""Run the official See-through demo once, recording status and output paths."""
import argparse
import json
import time
import traceback
from pathlib import Path

from gradio_client import Client, handle_file

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser(description="Upload one image to the official external See-through demo.")
parser.add_argument("input", type=Path, help="Image to send to Hugging Face")
parser.add_argument("--out", type=Path, default=ROOT / "demo-results")
parser.add_argument("--allow-external-upload", action="store_true", help="Confirm the image may be sent to this external service")
args = parser.parse_args()
if not args.allow_external_upload:
    parser.error("External upload not enabled. Confirm authorization before using --allow-external-upload.")
if not args.input.is_file():
    parser.error("Input image does not exist")
OUT = args.out.resolve()
OUT.mkdir(parents=True, exist_ok=True)
report = {
    "backend": "https://24yearsold-see-through-demo.hf.space",
    "input": str(args.input.resolve()),
    "input_status": "Experimental decomposition, requires visual review",
    "resolution": 768,
    "seed": 42,
    "split_left_right": True,
    "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "status": "initializing",
}

def save():
    (OUT / "run.json").write_text(json.dumps(report, indent=2) + "\n")

save()
t0 = time.monotonic()
client = None
job = None
try:
    print("Connecting to official See-through demo...", flush=True)
    client = Client(report["backend"], verbose=False, download_files=str(OUT),
                    httpx_kwargs={"timeout": 60})
    print("Submitting image, resolution 768, seed 42, L/R split enabled...", flush=True)
    job = client.submit(handle_file(report["input"]), 768, 42, True,
                        api_name="/inference")
    report["status"] = "submitted"
    save()
    last_status = None
    while not job.done():
        status = job.status()
        line = str(status)
        if line != last_status:
            print(line, flush=True)
            last_status = line
        if time.monotonic() - t0 > 720:
            job.cancel()
            raise TimeoutError("Stopped waiting after 12 minutes; inspect remote queue before retrying.")
        time.sleep(5)
    result = job.result()
    report["status"] = "success"
    report["result"] = result
    print("RESULT", json.dumps(result), flush=True)
except Exception as exc:
    report["status"] = "failed"
    report["error"] = f"{type(exc).__name__}: {exc}"
    print(report["error"], flush=True)
    traceback.print_exc()
finally:
    report["elapsed_seconds"] = round(time.monotonic() - t0, 2)
    save()
    if client is not None:
        client.close()
