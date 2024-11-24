import os
from dotenv import load_dotenv

# Tải các biến môi trường từ file .env
load_dotenv()

class Config:
    # Cấu hình cơ sở dữ liệu
    MONGODB_URI = os.getenv("MONGODB_URI")
    API_KEY = os.getenv("API_KEY")
    
    # Cấu hình ứng dụng
    RELOAD = True  # Thay đổi thành False trong môi trường sản xuất
    HOST = "0.0.0.0"
    PORT = 8000

# Nếu bạn có nhiều môi trường, bạn có thể tạo các lớp khác nhau
class ProductionConfig(Config):
    RELOAD = False

class DevelopmentConfig(Config):
    RELOAD = True