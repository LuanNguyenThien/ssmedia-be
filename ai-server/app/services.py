import re, json, traceback
from app.config import Config
import google.generativeai as genai
from langdetect import detect, LangDetectException
from .utils import blacklist_categories, is_math_expression, is_meaningful_text, analyze_math_expression, preprocess_text, combine_text, get_albert_embedding, store_vector_in_mongodb, collection

genai.configure(api_key=Config.API_KEY)

async def translate_to_english(text):
    try:
        # Sử dụng Gemini để dịch văn bản sang tiếng Anh
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"Dịch câu sau sang tiếng Anh giúp tôi, đang cần để vector hóa dữ liệu: '{text}'"
        response = model.generate_content(prompt)
    
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini analysis: {str(e)}")
        return None

async def analyze_content_with_gemini(content, language):
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"""Analyze the following content for a learning-focused social network:

        Content: "{content}"
        Language: {language}

        Please provide a comprehensive analysis covering the following aspects:
        1. Main Topics (Array[MainTopics])
        2. Educational Value (or Something ralated to Discover, Research around the world score 1-10)
        3. Relevance to Learning Community (score 1-10)
        4. Content Appropriateness: Evaluate if the content is appropriate or not for a learning community (evaluation: "Appropriate" or "Not Appropriate"). Consider factors like language, tone, and subject matter. Pay special attention to any content that might fall into the following inappropriate categories:
        {', '.join(blacklist_categories)}
        5. Key Concepts (Array[Concepts])
        6. Potential Learning Outcomes
        7. Related Academic Disciplines (Array[Disciplines])
        8. Content Classification (Type:? , Subject:?, Range Age Suitable:?)
        9. Engagement Potential (score 1-100)
        10. Credibility and Sources (score 1-10)
        11. Improvement Suggestions
        12. Related Topics (Array[Topics])
        13. Content Tags (Array[Tags])

        Format your response as a JSON object with these keys."""

        response = model.generate_content(prompt)
        print("Gemini: ", response.text)
        
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None

        return response.text
    
    except Exception as e:
        print(f"Error in Gemini analysis: {str(e)}")
        return None

async def analyze_content(content, id):
    try:
        # Xác định loại nội dung
        if is_math_expression(content):
            content_type = "Mathematical Expression"
            math_analysis = analyze_math_expression(content)
            return {
                "content_type": content_type,
                "math_analysis": math_analysis,
                "is_appropriate": True,
                "educational_value": 10,
                "main_topics": ["Mathematics"],
                "key_concepts": [str(math_analysis["original"])]
            }
        elif not is_meaningful_text(content):
            content_type = "Special Characters/Numbers"
        else:
            content_type = "Text"
        
        # Phát hiện ngôn ngữ (chỉ cho nội dung văn bản)
        try:
            language = detect(content) if content_type == "Text" else "N/A"
        except LangDetectException:
            language = "Unknown"

        print(f"Content type: {content_type}")
        print(f"Detected language: {language}")

        # Dịch sang tiếng Anh nếu cần
        if language != 'en' and language != "Unknown":
            translated_content = await translate_to_english(content)
            if translated_content:
                content_for_analysis = translated_content
            else:
                content_for_analysis = content  # Sử dụng nội dung gốc nếu dịch thất bại
        else:
            content_for_analysis = content

        content_for_analysis = preprocess_text(content_for_analysis)

        # Phân tích với Gemini
        gemini_analysis = await analyze_content_with_gemini(content_for_analysis, "English")
        cleaned_analysis_str = re.sub(r'```json|```', '', gemini_analysis).strip()

        cleaned_analysis = json.loads(cleaned_analysis_str)

        combined_result = combine_text(
            main_topics=cleaned_analysis.get("Main Topics", []),
            key_concepts=cleaned_analysis.get("Key Concepts", []),
            disciplines=cleaned_analysis.get("Related Academic Disciplines", []),
            range_age_suitable=cleaned_analysis["Content Classification"].get("Range Age Suitable", "N/A"), 
            related_topics=cleaned_analysis.get("Related Topics", []),
            content_tags=cleaned_analysis.get("Content Tags", [])
        )
        combined_result = preprocess_text(combined_result)
        print(f"Combined_result: {combined_result}")
        vector = get_albert_embedding(combined_result).tolist()
        store_vector_in_mongodb(collection, vector, id)

        return cleaned_analysis_str

    except Exception as e:
        print(f"Error in content analysis: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}
    
async def vectorize_query(query):
    try:
        query = await translate_to_english(query)
        preprocessed_query = preprocess_text(query)
        vector = get_albert_embedding(preprocessed_query)
        return vector
    except Exception as e:
        print(f"Error in vectorize query: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}