import asyncio
import random
import time
from typing import List, Tuple
from collections import defaultdict
import google.generativeai as genai
from app.config import Config

class APIKeyManager:
    def __init__(self):
        self.analysis_keys = Config.ANALYSIS_KEYS
        self.search_keys = Config.SEARCH_KEYS

        # Tạo semaphore cho mỗi key (1 concurrent request per key)
        self.analysis_semaphores = {
            key: asyncio.Semaphore(1) for key in self.analysis_keys
        }
        self.search_semaphores = {
            key: asyncio.Semaphore(1) for key in self.search_keys
        }

        # Track usage statistics cho load balancing
        self.analysis_usage_count = defaultdict(int)
        self.search_usage_count = defaultdict(int)

        # Track last request time cho rate limiting
        self.last_request_time = {}
        self.min_delay = 4.0

        # Track daily usage (reset every day)
        self.daily_usage = defaultdict(int)
        self.last_reset_date = time.strftime("%Y-%m-%d")

    def _reset_daily_usage_if_needed(self):
        """Reset daily usage counter nếu sang ngày mới"""
        current_date = time.strftime("%Y-%m-%d")
        if current_date != self.last_reset_date:
            print(f"Resetting daily usage counters for new day: {current_date}")
            self.daily_usage.clear()
            self.last_reset_date = current_date

    def _get_available_keys_with_load_balancing(self, keys_pool, semaphores, usage_count):
        """Lấy danh sách keys available và sort theo usage (ít nhất trước)"""
        self._reset_daily_usage_if_needed()
        
        available_keys = []
        for key in keys_pool:
            # Check daily limit (900/1000 để có buffer)
            if self.daily_usage[key] >= 900:
                print(f"API key {key[:10]}... reached daily limit, skipping")
                continue
                
            # Check if semaphore is available
            if not semaphores[key].locked():
                available_keys.append(key)
        
        if not available_keys:
            return []
        
        # Sort theo usage count (ít nhất trước) để load balance
        available_keys.sort(key=lambda k: usage_count[k])
        return available_keys

    async def get_analysis_key(self) -> Tuple[str, asyncio.Semaphore]:
        """Lấy API key cho content analysis với smart load balancing"""
        available_keys = self._get_available_keys_with_load_balancing(
            self.analysis_keys, 
            self.analysis_semaphores, 
            self.analysis_usage_count
        )
        
        if available_keys:
            # Lấy 5 keys có usage ít nhất và random trong đó
            top_keys = available_keys[:min(5, len(available_keys))]
            selected_key = random.choice(top_keys)
            
            print(f"Selected analysis key: {selected_key[:10]}... (usage: {self.analysis_usage_count[selected_key]}, daily: {self.daily_usage[selected_key]})")
            return selected_key, self.analysis_semaphores[selected_key]
        
        # Nếu không có key nào available, chọn key có usage ít nhất và đợi
        print("All analysis keys busy, selecting least used key...")
        least_used_key = min(self.analysis_keys, key=lambda k: self.analysis_usage_count[k])
        return least_used_key, self.analysis_semaphores[least_used_key]

    async def get_search_key(self) -> Tuple[str, asyncio.Semaphore]:
        """Lấy API key cho search với smart load balancing"""
        available_keys = self._get_available_keys_with_load_balancing(
            self.search_keys, 
            self.search_semaphores, 
            self.search_usage_count
        )
        
        if available_keys:
            # Lấy 3 keys có usage ít nhất và random trong đó (search pool nhỏ hơn)
            top_keys = available_keys[:min(3, len(available_keys))]
            selected_key = random.choice(top_keys)
            
            print(f"Selected search key: {selected_key[:10]}... (usage: {self.search_usage_count[selected_key]}, daily: {self.daily_usage[selected_key]})")
            return selected_key, self.search_semaphores[selected_key]
        
        # Fallback
        print("All search keys busy, selecting least used key...")
        least_used_key = min(self.search_keys, key=lambda k: self.search_usage_count[k])
        return least_used_key, self.search_semaphores[least_used_key]

    async def make_request_with_rate_limit(self, api_key: str, request_func, *args, **kwargs):
        """Thực hiện request với intelligent rate limiting"""
        # Check daily limit trước khi request
        self._reset_daily_usage_if_needed()
        if self.daily_usage[api_key] >= 900:
            raise Exception(f"API key {api_key[:10]}... reached daily limit")
        
        # Enforce rate limiting per key (4 seconds = 15 req/minute max)
        current_time = time.time()
        last_time = self.last_request_time.get(api_key, 0)
        
        time_since_last = current_time - last_time
        if time_since_last < self.min_delay:
            sleep_time = self.min_delay - time_since_last
            print(f"Rate limiting: sleeping {sleep_time:.2f}s for key {api_key[:10]}...")
            await asyncio.sleep(sleep_time)
        
        # Configure API key before request
        genai.configure(api_key=api_key)
        
        try:
            result = await request_func(*args, **kwargs)
            
            # Update counters sau khi request thành công
            self.last_request_time[api_key] = time.time()
            self.daily_usage[api_key] += 1
            
            # Update usage count cho load balancing
            if api_key in self.analysis_keys:
                self.analysis_usage_count[api_key] += 1
            elif api_key in self.search_keys:
                self.search_usage_count[api_key] += 1
            
            print(f"Request successful. Key {api_key[:10]}... - Session usage: {self.analysis_usage_count[api_key] + self.search_usage_count[api_key]}, Daily: {self.daily_usage[api_key]}")
            
            return result
        except Exception as e:
            print(f"Error with API key {api_key[:10]}...: {str(e)}")
            # Vẫn update daily usage kể cả khi lỗi để tránh spam
            self.daily_usage[api_key] += 1
            raise e

    def get_usage_statistics(self):
        """Trả về thống kê usage để monitor"""
        self._reset_daily_usage_if_needed()
        
        analysis_stats = {}
        for key in self.analysis_keys:
            analysis_stats[key[:10] + "..."] = {
                "session_usage": self.analysis_usage_count[key],
                "daily_usage": self.daily_usage[key],
                "daily_remaining": max(0, 900 - self.daily_usage[key]),
                "is_available": not self.analysis_semaphores[key].locked()
            }
        
        search_stats = {}
        for key in self.search_keys:
            search_stats[key[:10] + "..."] = {
                "session_usage": self.search_usage_count[key],
                "daily_usage": self.daily_usage[key], 
                "daily_remaining": max(0, 900 - self.daily_usage[key]),
                "is_available": not self.search_semaphores[key].locked()
            }
        
        return {
            "analysis_keys": analysis_stats,
            "search_keys": search_stats,
            "total_daily_usage": sum(self.daily_usage.values()),
            "max_daily_capacity": len(self.analysis_keys + self.search_keys) * 900
        }
        
api_key_manager = APIKeyManager()