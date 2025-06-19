from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .services import analyze_content, vectorize_query  # Giả sử bạn đã định nghĩa analyze_content trong services.py
from .api_key_manager import api_key_manager

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

        gifUrl = value.get('gifUrl', None)
        if gifUrl is not None and gifUrl != '':
            image_urls.append(gifUrl)

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
        userInterest = value.get('userInterest', None)
        if userInterest == '':
            userInterest = None
        userHobbies = value.get('userHobbies', None)
        if userHobbies == '':
            userHobbies = None
        
        # Nhận kết quả từ vectorize_query
        result = await vectorize_query(query_text, image, userInterest, userHobbies)

        # Kiểm tra lỗi
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
            
        # Trả về cả vector và related_topics
        return JSONResponse(content={
            "vector": result["vector"].tolist(),
            "related_topics": result["related_topics"],
            "preprocessed_query": result["preprocessed_query"]
        })
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
# Optional: Health check endpoint to monitor API key status
@router.get('/api-status')
async def get_api_status():
    """Enhanced API status với usage statistics"""
    stats = api_key_manager.get_usage_statistics()
    
    # Calculate summary
    analysis_available = len([k for k, v in stats["analysis_keys"].items() if v["is_available"] and v["daily_remaining"] > 0])
    search_available = len([k for k, v in stats["search_keys"].items() if v["is_available"] and v["daily_remaining"] > 0])
    
    total_analysis_daily_remaining = sum([v["daily_remaining"] for v in stats["analysis_keys"].values()])
    total_search_daily_remaining = sum([v["daily_remaining"] for v in stats["search_keys"].values()])
    
    return {
        "summary": {
            "analysis_keys": {
                "total": len(api_key_manager.analysis_keys),
                "available": analysis_available,
                "busy": len(api_key_manager.analysis_keys) - analysis_available,
                "daily_remaining_total": total_analysis_daily_remaining
            },
            "search_keys": {
                "total": len(api_key_manager.search_keys),
                "available": search_available,
                "busy": len(api_key_manager.search_keys) - search_available,
                "daily_remaining_total": total_search_daily_remaining
            }
        },
        "detailed_stats": stats,
        "load_balancing": {
            "total_requests_today": stats["total_daily_usage"],
            "max_daily_capacity": stats["max_daily_capacity"],
            "capacity_used_percentage": round((stats["total_daily_usage"] / stats["max_daily_capacity"]) * 100, 2)
        }
    }

@router.get('/usage-report')
async def get_usage_report():
    """Báo cáo chi tiết usage để optimize"""
    stats = api_key_manager.get_usage_statistics()
    
    # Tìm keys được sử dụng nhiều nhất và ít nhất
    analysis_usage = [(k, v["session_usage"]) for k, v in stats["analysis_keys"].items()]
    search_usage = [(k, v["session_usage"]) for k, v in stats["search_keys"].items()]
    
    analysis_usage.sort(key=lambda x: x[1], reverse=True)
    search_usage.sort(key=lambda x: x[1], reverse=True)
    
    return {
        "load_distribution": {
            "analysis_keys": {
                "most_used": analysis_usage[0] if analysis_usage else None,
                "least_used": analysis_usage[-1] if analysis_usage else None,
                "usage_distribution": analysis_usage
            },
            "search_keys": {
                "most_used": search_usage[0] if search_usage else None,
                "least_used": search_usage[-1] if search_usage else None,
                "usage_distribution": search_usage
            }
        },
        "recommendations": {
            "load_balance_effectiveness": "Good" if len(set([u[1] for u in analysis_usage])) <= 2 else "Needs improvement",
            "daily_capacity_warning": stats["total_daily_usage"] > (stats["max_daily_capacity"] * 0.8)
        }
    }