import axios from 'axios';
import { config } from '@root/config';

export let BASE_ENDPOINT = '';

if (config.NODE_ENV === 'development') {
  BASE_ENDPOINT = 'http://localhost:8000';
} else if (config.NODE_ENV === 'production') {
  BASE_ENDPOINT = 'http://ai-server:8000';
} else if (config.NODE_ENV === 'staging') {
  BASE_ENDPOINT = 'https://api.stg.<your-backend-domain>';
} 

const BASE_URL = `${BASE_ENDPOINT}`;

export default axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  withCredentials: true
});