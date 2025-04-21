from fastapi import FastAPI
from .routes import router

# Khởi tạo ứng dụng FastAPI
app = FastAPI()

# Đăng ký các route
app.include_router(router)

# Nếu bạn có các middleware hoặc các phần mở rộng khác, bạn có thể cấu hình ở đây