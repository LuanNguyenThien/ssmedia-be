import { JSDOM } from 'jsdom';
import axios from 'axios';

export class HtmlParser {
  static async extractMediaUrls(htmlContent: string): Promise<Map<string, {element: string, type: string}>> {
    const mediaUrls = new Map<string, {element: string, type: string}>();
    
    try {
      const dom = new JSDOM(htmlContent);
      const document = dom.window.document;
      
      // Extract image URLs
      const images = document.querySelectorAll('img');
      images.forEach((img: HTMLImageElement) => {
        const src = img.getAttribute('src');
        if (src && src.includes('tmpfiles.org/dl/')) {
          mediaUrls.set(src, {element: 'img', type: 'image'});
        }
      });
      
      // Extract audio URLs
      const audios = document.querySelectorAll('audio');
      audios.forEach((audio: HTMLAudioElement) => {
        const src = audio.getAttribute('src');
        if (src && src.includes('tmpfiles.org/dl/')) {
          mediaUrls.set(src, {element: 'audio', type: 'audio'});
        }
      });
      
      // Extract video URLs
      const videos = document.querySelectorAll('video');
      videos.forEach((video: HTMLVideoElement) => {
        const src = video.getAttribute('src');
        if (src && src.includes('tmpfiles.org/dl/')) {
          mediaUrls.set(src, {element: 'video', type: 'video'});
        }
      });
      
      return mediaUrls;
    } catch (error) {
      console.error('Error extracting media URLs:', error);
      return new Map();
    }
  }
  
  static replaceMediaUrls(htmlContent: string, replacements: Map<string, string>): string {
    let updatedHtml = htmlContent;
    
    replacements.forEach((newUrl, oldUrl) => {
      // Thay thế URL trong HTML
      const escapedOldUrl = oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const srcRegex = new RegExp(`src=["']${escapedOldUrl}["']`, 'g');
      const dataUrlRegex = new RegExp(`data-url=["']${escapedOldUrl}["']`, 'g');
      
      // Thay thế các thuộc tính
      updatedHtml = updatedHtml
        .replace(srcRegex, `src="${newUrl}"`)
        .replace(dataUrlRegex, `data-url="${newUrl}"`);
    });
    
    return updatedHtml;
  }
}

// static async extractMediaUrls(htmlContent: string): Promise<Map<string, {element: string, type: string}>> {
//   const mediaUrls = new Map<string, {element: string, type: string}>();
  
//   try {
//     const dom = new JSDOM(htmlContent);
//     const document = dom.window.document;
    
//     // Extract image URLs từ src
//     const images = document.querySelectorAll('img');
//     images.forEach((img: HTMLImageElement) => {
//       const src = img.getAttribute('src');
//       if (src && src.includes('tmpfiles.org/dl/')) {
//         mediaUrls.set(src, {element: 'img', type: 'image'});
//       }
//     });
    
//     // Extract audio URLs từ src
//     const audios = document.querySelectorAll('audio');
//     audios.forEach((audio: HTMLAudioElement) => {
//       const src = audio.getAttribute('src');
//       if (src && src.includes('tmpfiles.org/dl/')) {
//         mediaUrls.set(src, {element: 'audio', type: 'audio'});
//       }
//     });
    
//     // Extract video URLs từ src
//     const videos = document.querySelectorAll('video');
//     videos.forEach((video: HTMLVideoElement) => {
//       const src = video.getAttribute('src');
//       if (src && src.includes('tmpfiles.org/dl/')) {
//         mediaUrls.set(src, {element: 'video', type: 'video'});
//       }
//     });

//     // Extract URLs từ data-url attribute của tất cả các thẻ
//     const elementsWithDataUrl = document.querySelectorAll('*[data-url]');
//     elementsWithDataUrl.forEach((element: Element) => {
//       const dataUrl = element.getAttribute('data-url');
//       if (dataUrl && dataUrl.includes('tmpfiles.org/dl/')) {
//         // Xác định loại media dựa trên extension hoặc context
//         let type = 'image'; // Mặc định là image
//         if (dataUrl.toLowerCase().endsWith('.mp3') || dataUrl.toLowerCase().endsWith('.wav') 
//             || dataUrl.toLowerCase().endsWith('.m4a') || dataUrl.toLowerCase().endsWith('.ogg')) {
//           type = 'audio';
//         } else if (dataUrl.toLowerCase().endsWith('.mp4') || dataUrl.toLowerCase().endsWith('.webm') 
//             || dataUrl.toLowerCase().endsWith('.avi') || dataUrl.toLowerCase().endsWith('.mov')) {
//           type = 'video';
//         }
//         mediaUrls.set(dataUrl, {element: element.tagName.toLowerCase(), type});
//       }
//     });
    
//     return mediaUrls;
//   } catch (error) {
//     console.error('Error extracting media URLs:', error);
//     return new Map();
//   }
// }

// static replaceMediaUrls(htmlContent: string, replacements: Map<string, string>): string {
//   try {
//     // Sử dụng JSDOM để phân tích và thay đổi HTML đúng cách
//     const dom = new JSDOM(htmlContent);
//     const document = dom.window.document;
    
//     // Xử lý img tags
//     const images = document.querySelectorAll('img');
//     images.forEach((img: HTMLImageElement) => {
//       const src = img.getAttribute('src');
//       if (src && replacements.has(src)) {
//         img.setAttribute('src', replacements.get(src)!);
//       }
//     });
    
//     // Xử lý audio tags
//     const audios = document.querySelectorAll('audio');
//     audios.forEach((audio: HTMLAudioElement) => {
//       const src = audio.getAttribute('src');
//       if (src && replacements.has(src)) {
//         audio.setAttribute('src', replacements.get(src)!);
//       }
//     });
    
//     // Xử lý video tags
//     const videos = document.querySelectorAll('video');
//     videos.forEach((video: HTMLVideoElement) => {
//       const src = video.getAttribute('src');
//       if (src && replacements.has(src)) {
//         video.setAttribute('src', replacements.get(src)!);
//       }
//     });
    
//     // Xử lý tất cả các thẻ có thuộc tính data-url chứa URL từ tmpfiles.org
//     const allElements = document.querySelectorAll('*[data-url]');
//     allElements.forEach((element: Element) => {
//       const dataUrl = element.getAttribute('data-url');
//       if (dataUrl && replacements.has(dataUrl)) {
//         element.setAttribute('data-url', replacements.get(dataUrl)!);
//       }
//     });
    
//     // Trả về HTML được cập nhật
//     return document.body.innerHTML;
//   } catch (error) {
//     console.error('Error replacing media URLs:', error);
//     // Trong trường hợp lỗi, trả về HTML gốc
//     return htmlContent;
//   }
// }