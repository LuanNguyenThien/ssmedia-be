from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from .services import analyze_content, vectorize_query  # Giả sử bạn đã định nghĩa analyze_content trong services.py

router = APIRouter()

class AnalyzeRequest(BaseModel):
    value: dict
class VectorizeRequest(BaseModel):
    value: str

@router.post('/analyze')
async def analyze_post(request: AnalyzeRequest):
    try:
        value = request.value
        content = value['post']
        id = value['_id']
        result = await analyze_content(content, id)  # Gọi hàm phân tích nội dung
        return JSONResponse(content=result)
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
    
@router.post('/vectorize')
async def vectorize(request: VectorizeRequest):
    try:
        query_text = request.value  # Lấy dữ liệu từ request
        vector_query = await vectorize_query(query_text)  # Tiền xử lý văn bản
        return JSONResponse(content={"vector": vector_query.tolist()})  # Trả lại vector dưới dạng JSON
    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))