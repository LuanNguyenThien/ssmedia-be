import re, json, traceback
from app.config import Config
import google.generativeai as genai
from .utils import blacklist_categories, is_meaningful_text, preprocess_text, combine_text, get_albert_embedding, store_vector_in_mongodb, collection
import base64
import requests

genai.configure(api_key=Config.API_KEY)

async def clarify_text_for_vectorization(text, image=None):
    try:
        # Sử dụng Gemini để làm rõ ý nghĩa của văn bản
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        prompt = f"""You are an assistant specializing in analyzing and extracting concise key topics or noun phrases for semantic search and vectorization. Your primary goal is to identify the core intent of the input text and extract relevant keywords or concepts, prioritizing domain-specific knowledge before any secondary aspects (e.g., study skills or strategies). The output must always be clean, concise, and in English, regardless of the input language.

        Key Instructions:
        1. Extract primary noun phrases or keywords that represent the core knowledge area or topic of the input text (e.g., "history" and related subfields). Prioritize academic content or factual aspects over secondary skills or techniques.
        2. Rank keywords in descending order of relevance:
            Begin with keywords or phrases related to the core domain knowledge.
            Follow with secondary keywords such as strategies, tools, or learning methods.
        3. Suggest related topics or concepts to expand the focus area, ensuring alignment with the input text. Avoid redundancy and unrelated terms.
        4. All outputs must be written in English, even if the input text is in another language (e.g., Vietnamese).
        
        Input Text: '{text}'

        Output Structure:
            Main Idea: [A concise summary of the user's intent or the primary topic in English.]
            Related Topics: (At least 8-15 related topics or subfields in English, listed in order of relevance.)
                [Primary domain-specific keywords ranked by relevance.]
                [Additional subtopics or related concepts expanding on the domain.]
                [If content is relevant to request document. Bonus some keywords related to learning methods or document, research, share knowledge, exam document about topics and subjects.]
                [Keywords related to study strategies or techniques at the end.]
            Summary: (A concise, high-value summary of the main content in English, focusing on the core ideas and key information. 
            The summary should be a short paragraph, not a list, and should avoid generic statements. This summary is intended for semantic vectorization, 
            so it must capture the essence and most important points of the content clearly and succinctly.)

        Avoid including unrelated terms or overly broad explanations. Use the following example as a reference format:
        Example Input and Output:
        ---

        **Example Input**: "Ôn thi học sinh giỏi sử"
        **Output**:
        - **Main Idea**: Preparation for advanced history exams.
        - **Related Topics**:
        - History (general)
        - Vietnamese history
        - Vietnamese culture
        - World history
        - Historical events (e.g., wars, revolutions)
        - Key historical figures
        - Historiography (the study of historical writing)
        - Cultural and political history
        - Document about historical
        - Document for history exam preparation
        - THPT High School Graduation Exam
        - Study materials for history
        - Exam preparation techniques
        - Learning strategies for history
        **The content focuses on preparing for the history exam for academically gifted students, emphasizing study strategies, key historical topics, and resources tailored for excelling in competitive academic settings.**

        ---

        Provide the result strictly in the format above, ensuring clarity, relevance, and conciseness.
            - Ensure domain-specific keywords dominate the list, with skills and strategies positioned only as secondary or supporting concepts.
            - Avoid generic modifiers or filler words unless they significantly impact meaning.
            - Maintain clean, semantically relevant outputs in English for optimal use in vectorization and semantic search.
        Return as fast as possible, and avoid unnecessary explanations or context.
        """

        # prompt = f"""Please clarify the following text to ensure it is meaningful and semantically rich for vectorization purposes. 
        # The text might be short or unclear, so provide a more detailed and clear version, need the result in a paragraph focus on content of text and related keyword, topic by english:

        # Original Text: '{text}'"""

        # prompt = f"""
        # You are a semantic analysis assistant helping to optimize text for vectorization in a search and personalization system. 
        # Please enhance the following text by:

        # 1. Clarifying and expanding its meaning, especially if it is short or ambiguous.
        # 2. Providing additional context, key terms, and related concepts to ensure the text is semantically rich and well-structured.
        # 3. Structuring the response in a concise paragraph that maintains focus on the main idea and related topics.

        # The goal is to maximize the text's informativeness and semantic richness for efficient data vectorization. The answer should be in English.

        # Original Text: '{text}'
        # """

        content_input = []
        if image is not None:
            image_part = {
                "mime_type": "image/jpeg",
                "data": image
            }
            
            content_input = [
                f"""The following analysis should consider both the image and text content together:
                
                Text Content: "{text}"
                Image: [Image is attached below. Please analyze the visual elements, subject matter, objects, text in the image, context, and educational relevance.]
                
                Provide a comprehensive analysis that integrates insights from both the text and image, focusing on how they complement or relate to each other.""", 
                image_part,
                prompt
            ]
            response = model.generate_content(content_input)
        else:
            # Nếu chỉ có text, sử dụng prompt thông thường
            response = model.generate_content(prompt)
        
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini clarification: {str(e)}")
        return None

async def translate_to_english(text):
    try:
        # Sử dụng Gemini để dịch văn bản sang tiếng Anh
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        prompt = f"Dịch câu sau sang tiếng Anh giúp tôi, đang cần để vector hóa dữ liệu: '{text}'"
        response = model.generate_content(prompt)
    
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None
        
        return response.text
    
    except Exception as e:
        print(f"Error in Gemini analysis: {str(e)}")
        return None

async def analyze_content_with_gemini(content, language, image_urls=None, video_urls=None, audio_urls=None):
    try:
        model = genai.GenerativeModel('models/gemini-2.0-flash')
        # prompt = f"""Analyze the following content by english for a learning-focused social network:

        # Content: "{content}"
        # Language: {language}

        # Please provide a comprehensive analysis covering the following aspects:
        # 1. Main Topics (Array[MainTopics])
        # 2. Educational Value (or Something ralated to Discover, Research around the world score 1-10)
        # 3. Relevance to Learning Community (score 1-10)
        # 4. Content Appropriateness: Evaluate if the content is appropriate or not for a learning community (evaluation: "Appropriate" or "Not Appropriate"). Consider factors like content's value, tone, and subject matter. Pay special attention to any content that might fall into the following inappropriate categories:
        # {', '.join(blacklist_categories)}
        # 5. Key Concepts (Array[Concepts])
        # 6. Potential Learning Outcomes
        # 7. Related Academic Disciplines (Array[Disciplines])
        # 8. Content Classification (Type:? , Subject:?, Range Age Suitable:?)
        # 9. Engagement Potential (score 1-100)
        # 10. Credibility and Sources (score 1-10)
        # 11. Improvement Suggestions
        # 12. Related Topics (Array[Topics])
        # 13. Content Tags (Array[Tags])

        # Format your response as a JSON object with these keys."""
        prompt = f"""Analyze the following content for a learning-focused social network:

        Content: "{content}"
        Language: {language}

        Your task is to provide a structured analysis of the content, focusing on its educational relevance and appropriateness for a learning community. If it has some media, please analyze the visual elements, subject matter, objects, text in all media (if any), context, and educational relevance. Then, provide a comprehensive analysis that integrates insights from all the text and media, focusing on how they complement or relate to each other, it must be follow the format of the JSON object below.
        If the content is not appropriate, please return the JSON object with all values as "N/A" except for Content Appropriateness, which should be "Not Appropriate".
        Please return your analysis in JSON format, strictly adhering to the keys defined below. Do not include any introductory or concluding sentences outside of the JSON structure.

        Analysis should cover the following aspects, and be formatted as a JSON object with these keys:
        
        1. Main Topics (List of Main Topics identified in the content combined with media if any)
        2. Educational Value (Score assessing educational value (1-10, higher is better))
        3. Relevance to Learning Community (Score assessing relevance (1-10, higher is better))
        4. Content Appropriateness: Evaluate if the content is appropriate for a learning community. Value MUST be either 'Appropriate' or 'Not Appropriate'.
           Be EXTREMELY STRICT in your evaluation, especially with media. The content must be marked 'Not Appropriate' if ANY of these criteria are met:
           - Images (Media) showing inappropriate body exposure, suggestive poses, or sexualized content even if subtle or disguised with educational claims
           - Images (Media) of people deliberately showing off their bodies in ways that are not relevant to educational context
           - Deliberately provocative content that's trying to bypass filtering by using educational text as cover
           - Any content that attempts to use educational claims (like "fitness education" or "health tips") as a pretext for sharing inappropriate visual content
           - For fitness, sports, or physical education content: Only mark as 'Not Appropriate' if the images (media) are excessively revealing, focus primarily on body display rather than demonstrating techniques, or use deliberately provocative poses unrelated to the educational purpose
           - Content that is not educational or relevant to the learning community
           - Any of these inappropriate categories: {', '.join(blacklist_categories)}
           Analyze all the text AND media carefully - treat mismatches between appropriate text and inappropriate media as 'Not Appropriate'
        5. Key Concepts (List of Key Concepts)
        6. Potential Learning Outcomes(List of Potential Learning Outcomes)
        7. Related Academic Disciplines (List of Related Disciplines)
        8. Content Classification (
            Type: Content Type (e.g., Article, Video, Question, Tutorial), 
            Subject: Subject Matter, 
            Range Age Suitable: Age range suitable (e.g., '13-18 years', 'Adults', 'All Ages', or 'N/A')
        )
        9. Engagement Potential (Score estimating engagement potential (1-100, higher is better))
        10. Credibility and Sources (Score assessing credibility (1-10, higher is better))
        11. Improvement Suggestions (Suggestions for improvement)
        12. Related Topics (List of Related Topics)
        13. Content Tags (List of Tags)
        14. Content Summary (A concise, high-value summary of the main content in English, focusing on the core ideas and key information. 
            The summary should be a short paragraph, not a list, and should avoid generic statements. This summary is intended for semantic vectorization, 
            so it must capture the essence and most important points of the all content and media (if it has good value) clearly and succinctly.)
        15. Reasoning (If the content is not appropriate, please provide a detailed explanation of why it was deemed inappropriate. This should include specific references to the content and media that led to this conclusion.)

        Ensure that your ENTIRE response is a valid JSON object.
        """
        content_input = []
        media_description = []
        if image_urls is not None:
            if not isinstance(image_urls, list):
                image_urls = [image_urls]
            if len(image_urls) > 0:
                media_description.append(f"{len(image_urls)} image(s)")

            for i, url in enumerate(image_urls):
                try:
                    print(f"Processing image {i+1} at URL: {url}")
                    response = requests.get(url)
                    if response.status_code == 200:
                        image_bytes = response.content
                        image_part = {
                            "mime_type": "image/jpeg",  # Default to JPEG
                            "data": image_bytes
                        }
                        content_input.append(image_part)
                    else:
                        print(f"Failed to fetch image {i+1} from URL: {url}, status code: {response.status_code}")
                except Exception as e:
                    print(f"Error processing image {i+1} at URL {url}: {str(e)}")
            # image_part = {
            #     "mime_type": "image/jpeg",
            #     "data": image
            # }
            # if content:
            #     content_input = [
            #         f"""The following analysis should consider both the image and text content together:
                    
            #         Text Content: "{content}"
            #         Image: [Image is attached below. Please analyze the visual elements, subject matter, objects, text in the image, context, and educational relevance.]
                    
            #         Provide a comprehensive analysis that integrates insights from both the text and image, focusing on how they complement or relate to each other.""", 
            #         image_part
            #     ]
            # else:
            #     content_input = [
            #         f"""Please analyze the following image for a learning-focused social network:
                    
            #         Image: [Image is attached below. Please analyze the visual elements, subject matter, objects, text in the image (if any), context, educational relevance, and appropriateness.]
                    
            #         Focus on extracting all meaningful information that can be used for educational purposes.""", 
            #         image_part
            #     ]
        if video_urls is not None:
            if not isinstance(video_urls, list):
                video_urls = [video_urls]
            if len(video_urls) > 0:
                media_description.append(f"{len(video_urls)} video")
                content_input.append("Video file included in the content:")

                for i, url in enumerate(video_urls):
                    if "https://www.youtube.com/watch?v=" in url:
                        content_input.append(f"Video URL: {url}")
                    else:
                        try:
                            response = requests.get(url)
                            if response.status_code == 200:
                                video_bytes = response.content
                                video_part = {
                                    "mime_type": "video/mp4",  # Updated to reflect audio MIME type
                                    "data": video_bytes
                                }
                                content_input.append(video_part)
                            else:
                                print(f"Failed to fetch video {i+1} from URL: {url}, status code: {response.status_code}")
                        except Exception as e:
                            print(f"Error processing video {i+1} at URL {url}: {str(e)}")

        if audio_urls is not None:
            if not isinstance(audio_urls, list):
                audio_urls = [audio_urls]
            if len(audio_urls) > 0:
                media_description.append(f"{len(audio_urls)} audio")
                content_input.append("Audio file included in the content:")

                for i, url in enumerate(audio_urls):
                    try:
                        response = requests.get(url)
                        if response.status_code == 200:
                            audio_bytes = response.content
                            audio_part = {
                                "mime_type": "audio/mp4",  # Updated to reflect audio MIME type
                                "data": audio_bytes
                            }
                            content_input.append(audio_part)
                        else:
                            print(f"Failed to fetch audio {i+1} from URL: {url}, status code: {response.status_code}")
                    except Exception as e:
                        print(f"Error processing audio {i+1} at URL {url}: {str(e)}")

        if media_description:
            media_summary = f"Analyze the content include: {', '.join(media_description)} and text content."
            content_input.insert(0, media_summary)
        print(content_input + [prompt])
        response = model.generate_content(content_input + [prompt])
        print("Gemini: ", response.text)
        
        if response.prompt_feedback.block_reason:
            print(f"Response blocked. Reason: {response.prompt_feedback.block_reason}")
            return None

        return response.text
    
    except Exception as e:
        print(f"Error in Gemini analysis: {str(e)}")
        return None

async def analyze_content(content, id, image_urls=None, video_urls=None, audio_urls=None):
    try:
        if not is_meaningful_text(content):
            content_type = "Special Characters/Numbers"
        else:
            content_type = "Text"
        
        # Phát hiện ngôn ngữ (chỉ cho nội dung văn bản)
        # try:
        #     language = detect(content) if content_type == "Text" else "N/A"
        # except LangDetectException:
        #     language = "Unknown"

        print(f"Content type: {content_type}")
        # print(f"Detected language: {language}")

        # Dịch sang tiếng Anh nếu cần
        # if language != 'en' and language != "Unknown":
        #     translated_content = await translate_to_english(content)
        #     if translated_content:
        #         content_for_analysis = translated_content
        #     else:
        #         content_for_analysis = content  # Sử dụng nội dung gốc nếu dịch thất bại
        # else:
        #     content_for_analysis = content

        # content_for_analysis = preprocess_text(content_for_analysis)

        if image_urls is not None:
            # Giải mã base64 nếu cần
            if isinstance(image_urls, str):
                if image_urls.startswith("data:image/jpeg;base64,") or image_urls.startswith("data:image/png;base64,"):
                    image_data = image_urls.split(",")[1]
                    image_urls = base64.b64decode(image_data)
                elif image_urls.startswith("http://") or image_urls.startswith("https://"):
                    image_urls = [image_urls]
            else:
                image_urls = image_urls
        
        if isinstance(image_urls, list) and len(image_urls) == 0:
            image_urls = None
        if isinstance(video_urls, list) and len(video_urls) == 0:
            video_urls = None
        if isinstance(audio_urls, list) and len(audio_urls) == 0:
            audio_urls = None
            
        # Phân tích với Gemini
        gemini_analysis = await analyze_content_with_gemini(content, "English", image_urls, video_urls, audio_urls)
        cleaned_analysis_str = re.sub(r'```json|```', '', gemini_analysis).strip()

        cleaned_analysis = json.loads(cleaned_analysis_str)

        if(cleaned_analysis.get("Content Appropriateness") != "Not Appropriate"):
            combined_result = combine_text(
                content_summary=cleaned_analysis.get("Content Summary", "N/A"),
                main_topics=cleaned_analysis.get("Main Topics", []),
                key_concepts=cleaned_analysis.get("Key Concepts", []),
                disciplines=cleaned_analysis.get("Related Academic Disciplines", []),
                range_age_suitable=cleaned_analysis["Content Classification"].get("Range Age Suitable", "N/A"), 
                related_topics=cleaned_analysis.get("Related Topics", []),
                content_tags=cleaned_analysis.get("Content Tags", []),
                potential_outcomes=cleaned_analysis.get("Potential Learning Outcomes", [])
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
    
async def vectorize_query(query, image=None, userInterest=None):
    try:
        if image is not None:
            # Giải mã base64 nếu cần
            if isinstance(image, str):
                if image.startswith("data:image/jpeg;base64,") or image.startswith("data:image/png;base64,"):
                    image_data = image.split(",")[1]
                    image = base64.b64decode(image_data)
                elif image.startswith("http://") or image.startswith("https://"):

                    try:
                        response = requests.get(image)
                        if response.status_code == 200:
                            image = response.content
                        else:
                            print(f"Failed to fetch image from URL: {image}, status code: {response.status_code}")
                            image = None
                    except Exception as e:
                        print(f"Error fetching image from URL: {str(e)}")
                        image = None
        if (query is not None and query != '') or (image is not None):
            query = await clarify_text_for_vectorization(query, image)
        if userInterest is not None:
            query = f"{query} {userInterest}"
        preprocessed_query = preprocess_text(query)
        print(f"Preprocessed query: {preprocessed_query}")
        vector = get_albert_embedding(preprocessed_query)
        return vector
    except Exception as e:
        print(f"Error in vectorize query: {str(e)}")
        traceback.print_exc()
        return {"error": str(e)}