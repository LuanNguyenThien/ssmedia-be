from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .services import analyze_content, vectorize_query  # Giả sử bạn đã định nghĩa analyze_content trong services.py

router = APIRouter()

class AnalyzeRequest(BaseModel):
    value: dict
class VectorizeRequest(BaseModel):
    value: dict

@router.post('/analyze')
async def analyze_post(request: AnalyzeRequest):
    try:
        value = request.value
        content = value['post']

        image_urls = []
        video_urls = []
        audio_urls = []
        mediaItems = value.get('mediaItems', None)
        if mediaItems is not None:
            image_urls = mediaItems.get('images', [])
            video_urls = mediaItems.get('videos', [])
            audio_urls = mediaItems.get('audios', [])

        if value['imgId'] != '' and value['imgVersion'] != '':
            # Clean the version and id strings by removing any quotes
            img_id = value['imgId'].replace("'", "").replace('"', '')
            img_version = value['imgVersion'].replace("'", "").replace('"', '')
            
            # Extract the version number from the full version string
            version = img_version.split('/')[0]
            
            # Create the Cloudinary URL
            url = f"https://res.cloudinary.com/di6ozapw8/image/upload/v{version}/{img_id}"
            image_urls = url

        if value['videoId'] != '' and value['videoVersion'] != '':
            # Clean the version and id strings by removing any quotes
            video_id = value['videoId'].replace("'", "").replace('"', '')
            video_version = value['videoVersion'].replace("'", "").replace('"', '')
            
            # Extract the version number from the full version string
            version = video_version.split('/')[0]
            
            # Create the Cloudinary URL
            url = f"https://res.cloudinary.com/di6ozapw8/video/upload/v{version}/{video_id}"
            video_urls = url
        id = value['_id']
        result = await analyze_content(content, id, image_urls, video_urls, audio_urls)  # Gọi hàm phân tích nội dung
        return JSONResponse(content=result)
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post('/vectorize')
async def vectorize(request: VectorizeRequest):
    try:
        value = request.value  # Lấy dữ liệu từ request
        query_text = value['query']  # Lấy văn bản truy vấn từ request
        image = value.get('image', None)
        if image == '':
            image = None
        vector_query = await vectorize_query(query_text, image)  # Tiền xử lý văn bản với hình ảnh
        return JSONResponse(content={"vector": vector_query.tolist()})  # Trả lại vector dưới dạng JSON
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))