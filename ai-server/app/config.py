import os
from dotenv import load_dotenv

# Tải các biến môi trường từ file .env
load_dotenv()

class Config:
    # Cấu hình cơ sở dữ liệu
    MONGODB_URI = os.getenv("MONGODB_URI")
    API_KEY = os.getenv("API_KEY")

    ANALYSIS_KEYS = [
        os.getenv("API_KEY_1"),
        os.getenv("API_KEY_2"),
        os.getenv("API_KEY_3"),
        os.getenv("API_KEY_4"),
        os.getenv("API_KEY_5"),
        os.getenv("API_KEY_6"),
        os.getenv("API_KEY_7"),
        os.getenv("API_KEY_8"),
        os.getenv("API_KEY_9"),
        os.getenv("API_KEY_10"),
        os.getenv("API_KEY_17"),
        os.getenv("API_KEY_18"),
        os.getenv("API_KEY_19"),
        os.getenv("API_KEY_20"),
        os.getenv("API_KEY_21"),
        os.getenv("API_KEY_22"),
        os.getenv("API_KEY_23")
    ]

    SEARCH_KEYS = [
        os.getenv("API_KEY_11"),
        os.getenv("API_KEY_12"),
        os.getenv("API_KEY_13"),
        os.getenv("API_KEY_14"),
        os.getenv("API_KEY_15"),
        os.getenv("API_KEY_16"),
        os.getenv("API_KEY_24"),
        os.getenv("API_KEY_25"),
        os.getenv("API_KEY_26"),
        os.getenv("API_KEY_27"),
        os.getenv("API_KEY_28"),
        os.getenv("API_KEY_29"),
        os.getenv("API_KEY_30"),
        os.getenv("API_KEY_31"),
        os.getenv("API_KEY_32"),
        os.getenv("API_KEY_33"),
        os.getenv("API_KEY_34")
    ]
    
    # Cấu hình ứng dụng
    RELOAD = True  # Thay đổi thành False trong môi trường sản xuất
    HOST = "0.0.0.0"
    PORT = 8000

# Nếu bạn có nhiều môi trường, bạn có thể tạo các lớp khác nhau
class ProductionConfig(Config):
    RELOAD = False

class DevelopmentConfig(Config):
    RELOAD = True