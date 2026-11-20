import subprocess
import sys
import time
import os
import signal
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

def free_ports():
    """Ensure ports 8088 and 5188 are not occupied by previous sessions."""
    if sys.platform == "win32":
        try:
            subprocess.run(
                [
                    "powershell", "-NoProfile", "-Command",
                    "Get-NetTCPConnection -LocalPort 8088,5188 -ErrorAction SilentlyContinue | "
                    "Select-Object -ExpandProperty OwningProcess -Unique | "
                    "ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"
                ],
                capture_output=True
            )
            time.sleep(0.8)
        except Exception:
            pass

def run_services():
    print("=" * 70)
    print("   LEGAL METROLOGY (PACKAGED COMMODITIES) COMPLIANCE SYSTEM")
    print("   Smart India Hackathon Problem Statement SIH26034")
    print("=" * 70)
    print(" Starting Backend & Frontend servers on distinct localhost ports:")
    print("   * Backend API:       http://localhost:8088")
    print("   * Interactive UI:    http://localhost:5188")
    print("   * API Documentation: http://localhost:8088/docs")
    print("=" * 70)
    print(" Press Ctrl+C to safely terminate both servers.\n")

    # Clean any lingering instances before binding
    free_ports()

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BASE_DIR / "backend")

    backend_proc = subprocess.Popen(
        [sys.executable, str(BASE_DIR / "backend" / "run_backend.py")],
        cwd=str(BASE_DIR / "backend"),
        env=env
    )

    time.sleep(1.5)

    frontend_proc = subprocess.Popen(
        [sys.executable, str(BASE_DIR / "frontend" / "serve_frontend.py")],
        cwd=str(BASE_DIR / "frontend")
    )

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print("Backend terminated.")
                break
            if frontend_proc.poll() is not None:
                print("Frontend terminated.")
                break
    except KeyboardInterrupt:
        print("\nStopping all services...")
    finally:
        try:
            backend_proc.terminate()
            backend_proc.kill()
        except Exception:
            pass
        try:
            frontend_proc.terminate()
            frontend_proc.kill()
        except Exception:
            pass
        free_ports()
        print("All servers stopped.")

if __name__ == "__main__":
    run_services()
