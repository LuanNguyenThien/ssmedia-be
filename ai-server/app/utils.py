import os
import re
import torch
import sympy
from app.config import Config
from transformers import pipeline, AutoTokenizer, AutoModel, AlbertTokenizer, AlbertModel
from pymongo import MongoClient
from bson import ObjectId
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

db_name = "test"
collection_name = "Post"

# Khởi tạo tokenizer và model cho ALBERT
tokenizer = AlbertTokenizer.from_pretrained("albert-base-v2")
model = AlbertModel.from_pretrained("albert-base-v2")

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


def connect_to_mongodb(db_name, collection_name):
    client = MongoClient(Config.MONGODB_URI)
    database = client[db_name]
    collection = database[collection_name]
    print("Connected to MongoDB")
    return collection

collection = connect_to_mongodb(db_name, collection_name)

def preprocess_text(text):
    # Tiền xử lý văn bản
    text = text.lower()
    text = re.sub(r'[^\w\s]', '', text)
    return text

def combine_text(main_topics, disciplines, key_concepts, range_age_suitable, related_topics, content_tags, potential_outcomes):
    combined_text = f"{', '.join(main_topics)}. {', '.join(content_tags)}. {', '.join(key_concepts)}. {', '.join(potential_outcomes)}. {', '.join(related_topics)}. {', '.join(disciplines)}. Age Suitable: {range_age_suitable}."
    return combined_text

def is_math_expression(text):
    if re.search(r'[^0-9+\-*/^().,\s|!%a-zA-Z]', text):
        return False
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

def get_albert_embedding(text):
    # Tokenize văn bản
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True)
    
    # Lấy embedding từ ALBERT
    with torch.no_grad():
        outputs = model(**inputs)
    
    # Tính trung bình của các hidden states để tạo vector cho câu
    return outputs.last_hidden_state.mean(dim=1).squeeze().numpy()

def store_vector_in_mongodb(collection, post_embedding, id):
    object_id = ObjectId(id)
    document = collection.find_one({"_id": object_id})
    if document is None:
        print(f"No document found with id: {id}")
        return
    
    collection.update_one(
        {"_id": object_id},
        {"$set": {"post_embedding": post_embedding}}
    )
    print("Document updated with vector data.")