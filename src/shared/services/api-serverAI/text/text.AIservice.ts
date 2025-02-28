import axios from "@service/axios";

class TextServiceAI {
  public async vectorizeText(value: string): Promise<any> {
    const response = await axios.post('/vectorize', { value });
    return response.data;
  }
}

export const textServiceAI: TextServiceAI = new TextServiceAI();