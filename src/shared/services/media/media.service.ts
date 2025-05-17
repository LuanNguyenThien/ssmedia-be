import { IPostMediaItem, IProcessedMedia } from '@post/interfaces/post-media.interface';
import { HtmlParser } from '@global/helpers/html-parser';
import { uploads, videoUpload } from '@global/helpers/cloudinary-upload';
import axios from 'axios';
import { UploadApiResponse } from 'cloudinary';
import { ObjectId } from 'mongodb';
import { config } from '@root/config';

class MediaService {
  public async processHtmlMedia(postId: ObjectId, htmlContent: string): Promise<IProcessedMedia> {
    try {
      // Extract all media URLs
      const mediaUrls = await HtmlParser.extractMediaUrls(htmlContent);
      
      // Process media concurrently
      const mediaItems: IPostMediaItem[] = [];
      const replacements = new Map<string, string>();
      
      // Use Promise.all for concurrent processing
      const promises = Array.from(mediaUrls.entries()).map(async ([url, info]) => {
        try {
          const mediaItem = await this.processMediaUrl(url, info.type);
          mediaItems.push(mediaItem);
          replacements.set(url, mediaItem.cloudinaryUrl);
        } catch (error) {
          console.error(`Error processing media ${url}:`, error);
          // If processing fails, we keep the original URL
        }
      });
      
      // Wait for all media processing to complete
      await Promise.all(promises);
      
      // Replace URLs in HTML content
      const updatedHtmlContent = HtmlParser.replaceMediaUrls(htmlContent, replacements);
      
      return {
        postId,
        htmlContent: updatedHtmlContent,
        mediaItems
      };
    } catch (error) {
      console.error('Error processing HTML media:', error);
      return {
        postId,
        htmlContent,
        mediaItems: []
      };
    }
  }
  
  private async processMediaUrl(url: string, mediaType: string): Promise<IPostMediaItem> {
    try {
      if (!url.startsWith('http')) {
        throw new Error(`Invalid URL format: ${url}`);
      }
      // Download media from temporary URL
      const response = await axios({
        method: 'get',
        url: url,
        responseType: 'arraybuffer',
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.data) {
        throw new Error(`Empty response from ${url}`);
      }
      
      const buffer = Buffer.from(response.data, 'binary');
      const base64Data = `data:${response.headers['content-type']};base64,${buffer.toString('base64')}`;
      
      // Upload to Cloudinary based on media type
      let result: UploadApiResponse;
      
      if (mediaType === 'video' || mediaType === 'audio') {
        result = await videoUpload(base64Data) as UploadApiResponse;
      } else {
        // For images, we can use the standard upload function
        result = await uploads(base64Data) as UploadApiResponse;
      }
      
      if (!result?.public_id) {
        throw new Error('Cloudinary upload failed');
      }
      
      // Construct Cloudinary URL
      const cloudinaryUrl = mediaType === 'video' || mediaType === 'audio' 
        ? `https://res.cloudinary.com/${config.CLOUD_NAME}/video/upload/v${result.version}/${result.public_id}` 
        : `https://res.cloudinary.com/${config.CLOUD_NAME}/image/upload/v${result.version}/${result.public_id}`;
      
      return {
        originalUrl: url,
        cloudinaryUrl,
        mediaType: mediaType as 'image' | 'audio' | 'video',
        publicId: result.public_id,
        version: result.version.toString()
      };
    } catch (error) {
      console.error(`Error processing media ${url}:`, error);
      throw error;
    }
  }
}

export const mediaService: MediaService = new MediaService();