import axios from "@service/axios";

class PostServiceAI {
  public async analyzePostContent(value: object): Promise<any> {
    const response = await axios.post('/analyze', { value });
    return response.data;
  }
}

export const postServiceAI: PostServiceAI = new PostServiceAI();