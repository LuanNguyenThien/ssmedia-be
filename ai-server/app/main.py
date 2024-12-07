import uvicorn
from app.config import Config
from . import serverai  # Import ứng dụng FastAPI

if __name__ == '__main__':
    uvicorn.run(serverai, host=Config.HOST, port=Config.PORT, log_level="info")