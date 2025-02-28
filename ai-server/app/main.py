import uvicorn
from app.config import Config

if __name__ == '__main__':
    uvicorn.run("app:app", host=Config.HOST, port=Config.PORT, log_level="info")