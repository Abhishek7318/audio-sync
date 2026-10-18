import os
import sys
import uvicorn

# Ensure the backend directory is in the python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

if __name__ == "__main__":
    is_frozen = getattr(sys, 'frozen', False)
    port = int(os.getenv("STORYREEL_PORT", 8765))
    host = os.getenv("STORYREEL_HOST", "127.0.0.1")
    backend_dir = os.path.abspath(os.path.dirname(__file__))
    print(f"Starting StoryReel Studio Local Backend on http://{host}:{port}")
    if is_frozen:
        from app.main import app
        uvicorn.run(app, host=host, port=port, log_level="info")
    else:
        uvicorn.run("app.main:app", host=host, port=port, log_level="info", reload=True, reload_dirs=[backend_dir])
