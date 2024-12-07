import json
from flask import Flask, request, jsonify
import traceback
from transformers import pipeline, AutoTokenizer, AutoModel
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
from underthesea import word_tokenize, pos_tag, ner
from langdetect import detect
import google.generativeai as genai
import re
from langdetect import detect, LangDetectException
import spacy
import sympy
import torch

app = Flask(__name__)

genai.configure(api_key='AIzaSyDBMEAn9R_ilsnOhBtiqrlLECs6gE7A-64')

# Định nghĩa các danh mục
whitelist_categories = [
    "Mathematics", "Science", "History", "Literature", "Art", "Technology",
    "Language", "Philosophy", "Psychology", "Economics", "Politics", "Geography",
    "Music", "Sports", "Medicine", "Environment", "Soft Skills", "Programming",
    "Business", "Design", "Law", "Biology", "Chemistry", "Physics",
    "Astronomy", "Religion", "Sociology", "Anthropology", "Archaeology",
    "Architecture", "Agriculture", "Finance", "Marketing", "Project Management",
    "Spirituality", "Nutrition", "Educational Psychology", "Information Technology",
    "Artificial Intelligence", "Robotics", "Renewable Energy", "Data Science",
    "Cybersecurity", "Blockchain", "Internet of Things", "Virtual Reality",
    "Augmented Reality", "Molecular Biology", "Nanotechnology", "Automation"
]

blacklist_categories = [
    "Pornographic Content", "Extreme Violence", "Racism", "Hate Speech",
    "Harassment", "Sensitive Personal Information", "Fraud", "Spam", "Illegal Advertising",
    "Illegal Drugs", "Illegal Weapons", "Illegal Gambling",
    "Terrorism", "Suicide", "Self-harm", "Child Exploitation", "Human Trafficking", "Animal Abuse",
    "Fake News", "Dangerous Conspiracy Theories", "Bullying", "Incitement of Hatred",
    "Copyright Infringement", "Instructions for Illegal Activities"
]

categories = whitelist_categories + blacklist_categories

tfidf = TfidfVectorizer()
tfidf.fit([' '.join(categories)])

def preprocess_text(text):
    # Tiền xử lý văn bản
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return text

def translate_to_english(text):
    try:
        # Sử dụng Gemini để dịch văn bản sang tiếng Anh
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"Translate the following text to English: '{text}'"
        response = model.generate_content(prompt)
    
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini analysis: {str(e)}")
        return None
    
def is_math_expression(text):
    try:
        sympy.sympify(text)
        return True
    except sympy.SympifyError:
        return False
    
def analyze_math_expression(text):
    try:
        expr = sympy.sympify(text)
        simplified = sympy.simplify(expr)
        solution = sympy.solve(expr)
        return {
            "original": str(expr),
            "simplified": str(simplified),
            "solution": str(solution) if solution else "No solution found or not an equation"
        }
    except Exception as e:
        return {"error": str(e)}
    
def is_meaningful_text(text):
    # Kiểm tra xem văn bản có chứa ít nhất một từ có nghĩa không
    words = re.findall(r'\b\w+\b', text)
    return len(words) > 0

def analyze_content_with_gemini(content, language):
    try:
        model = genai.GenerativeModel('gemini-pro')
        prompt = f"""Analyze the following content for a learning-focused social network:

        Content: "{content}"
        Language: {language}

        Please provide a comprehensive analysis covering the following aspects:
        1. Main Topics
        2. Educational Value (score 1-10)
        3. Relevance to Learning Community (score 1-10)
        4. Content Appropriateness: Evaluate if the content is appropriate or not for a learning community. Consider factors like language, tone, and subject matter. Pay special attention to any content that might fall into the following inappropriate categories:
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
    
def analyze_content(content):
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
            translated_content = translate_to_english(content)
            if translated_content:
                content_for_analysis = translated_content
            else:
                content_for_analysis = content  # Sử dụng nội dung gốc nếu dịch thất bại
        else:
            content_for_analysis = content

        # Phân tích với Gemini
        gemini_analysis = analyze_content_with_gemini(content_for_analysis, "English")
        print(f"Gemini Analysis: {gemini_analysis}")

        return gemini_analysis

    except Exception as e:
        print(f"Error in content analysis: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}

@app.route('/analyze', methods=['POST'])
def analyze_post():
    try:
        data = request.get_json()
        value = data['value']
        content = value['post']
        result = analyze_content(content)
        cleaned_result = re.sub(r'```json|```', '', result).strip()
        return jsonify(cleaned_result)
        # return result
    except Exception as e:
        print("Error:", str(e))
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)