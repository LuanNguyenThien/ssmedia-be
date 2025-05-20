import fs from 'fs';
import ejs from 'ejs';

class ForgotPasswordTemplate {
  public passwordResetTemplate(username: string, resetLink: string): string {
    return ejs.render(fs.readFileSync(__dirname + '/forgot-password-template.ejs', 'utf8'), {
      username,
      resetLink,
      image_url: 'https://cdn-icons-png.freepik.com/512/9578/9578810.png'
    });
  }
}

export const forgotPasswordTemplate: ForgotPasswordTemplate = new ForgotPasswordTemplate();
