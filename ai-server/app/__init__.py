from fastapi import FastAPI
from .routes import router

# Khởi tạo ứng dụng FastAPI
serverai = FastAPI()

# Đăng ký các route
serverai.include_router(router)

# Nếu bạn có các middleware hoặc các phần mở rộng khác, bạn có thể cấu hình ở đây