<h1>
  <a href="https://brainet.online" target="_blank" style="text-decoration: none;">
    <img src="https://brainet.online/assets/logo-CRUqoA6R.png" alt="icon" width="40" style="vertical-align: middle; margin-right: 8px;">
    <span style="color: #1264AB;">Brainet Backend</span>
  </a>
</h1>

### Tools & Technologies Usage

||||
|:-:|:-:|:-:|
|![First Image](https://www.opc-router.de/wp-content/uploads/2023/07/Docker_150x150px-01-01-01.png)|![Second Image](https://cdn2.fptshop.com.vn/unsafe/1920x0/filters:format(webp):quality(75)/2024_4_29_638500027423655626_aws-lightsail-la-gi.jpg)|![Third Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662482577/github_readme_images/pm2_owgicz.png)

|||||
|:-:|:-:|:-:|:-:|
|![First Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662482275/github_readme_images/redis-icon_xzk6f2.png)|![Second Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662482528/github_readme_images/Logo_RGB_Forest-Green_qjxd7x.png)|![Third Image](https://miro.medium.com/v2/resize:fit:1400/0*-VVwL0nee9RgEhJB.png)|![Fourth Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662482298/github_readme_images/ts-logo-512_jt9rmi.png)


|||||
|:-:|:-:|:-:|:-:|
|![Fourth Image](https://miro.medium.com/v2/resize:fit:812/0*xAADmPJN52Yy6XJV.jpg)|![Second Image](https://git.rwth-aachen.de/uploads/-/system/project/avatar/79028/WebRTC_Logo-700x590.png)|![First Image](https://blog.ionxsolutions.com/p/file-uploads-with-python-fastapi/header.png)|![Second Image](https://assets.apidog.com/blog-next/2025/02/Blue-Gradient-Modern-Sport-Presentation---2-.jpg)

|||||
|:-:|:-:|:-:|:-:|
|![First Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662483242/github_readme_images/cloudinary_logo_blue_0720_2x_n8k46z.png)|![Second Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662483106/github_readme_images/bull_y4erki.png)|![Third Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662482947/github_readme_images/sendgrid_d1v6dc.jpg)|![Fourth Image](https://res.cloudinary.com/dyamr9ym3/image/upload/v1662483059/github_readme_images/nodemailer_rfpntx.png)

<b>Brainet</b> backend server is a real-time social network for the digital knowledge community, fostering learing and knowledge sharing. It is developed with [Node.js](https://nodejs.org/en/), [Typescript](https://www.typescriptlang.org/), [Redis](https://redis.io/download/) and [Mongodb](https://www.mongodb.com/docs/manual/administration/install-community/), it leverages [Gemini API](https://ai.google.dev/) and ALBERT-based-v2 for vectorize combine with semantic search for content moderation and personalized recommendations.

## Features
**User Management**

1. Authentication: Sign up, sign in with email/password or Google OAuth.
2. Password Management: Forgot, reset, and change password securely.
3. Profile Management: Update personal information for personalized recommendations.
4. Social Connections: Follow, unfollow, block, unblock, or report users.

**Content & Interaction**

5. Posts: Create, update, delete posts with AI content moderation (Gemini API); view personalized or trending posts.
6. Questions & Answers: Post questions or provide answers, moderated by AI.
7. Engagement: Upvote/downvote posts, save posts, comment (create, delete, reply, vote).
8. Groups: Create and manage private or public groups for collaborative learning.

**Communication**

9. Real-Time Chat: Private or group chat with text, images, GIFs, and reactions via Socket.IO.
10. Voice/Video Call: 1:1 calls with screen-sharing support using WebRTC (simple-peer), managed by Redis Lock for concurrent call handling.

**Search & Personalization**

11. Semantic Search: Search text or images using ALBERT-based vector search (MongoDB Atlas Search).
12. Personalized Recommendations: AI-driven post suggestions based on user interests and interaction history (Redis for short-term, MongoDB for long-term).

**Notifications & Settings**

13. Notifications: In-app and email notifications for user interactions.
14. Settings: Customize notification preferences and personalization options.

**Admin Dashboard**

1. System Analytics: View statistics on users, posts
2. Content Moderation: Approve, reject, or delete posts/questions/answers
3. User Management: Handle user reports, ban/unban accounts

## System Architecture
![](https://res.cloudinary.com/di6ozapw8/image/upload/v1751225282/samples/people/smiling-man.jpg)

## Requirements

- Node 18.x or higher
- Python 3.10.x or higher
- Redis ([https://redis.io/download/](https://redis.io/download/))
- MongoDB ([https://www.mongodb.com/docs/manual/administration/install-community/](https://www.mongodb.com/docs/manual/administration/install-community/))
- Typescript
- API key, secret and cloud name from cloudinary [https://cloudinary.com/](https://cloudinary.com/)
- API key from Gemini [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Local email sender and password [https://ethereal.email/](https://ethereal.email/)

You'll need to copy the contents of `.env.development.example`, add to `.env` file and update with the necessary information.

## Local Installation

- There are three different branches dev, deploy-t6 and main. The dev branch is the default branch.

```bash
git clone -b dev https://github.com/LuanNguyenThien/ssmedia-be.git
cd ssmedia-be
npm install

cd ai-server
pip install -r requirements.txt
```
- To start the server after installation, run
```bash
npm run dev
```
- To start server-ai, run
```bash
python -m app.main
```

- Inside the `setupServer.ts` file, comment the line `sameSite: 'none'`.
- You'll need to uncomment that line again before you deploy to AWS.

Make sure mongodb and redis are both running on your local machine.

## Unit tests

- You can run the command `npm run test` to execute the unit tests added to the features controllers.

## View Data
- You can view the contents of your redis cache by using a tool called [redis-commander](https://www.npmjs.com/package/redis-commander).
- Download mongodb compass to view data. [https://www.mongodb.com/try/download/compass](https://www.mongodb.com/try/download/compass).

## Deployment
- **Docker Setup**: Configure Dockerfiles for backend and ai-server
- **Build & Orchestrate**: Use `docker-compose` to build and manage images for backend, ai-server, Redis
- **AWS Lightsail**: Deploy containers on AWS Lightsail for scalable hosting.
- **Networking & Security**: Set up nginx for reverse proxy, ufw for firewall, and SSL for secure connections.
- **Environment Config**: Define environment variables for Redis, MongoDB Atlas, Gemini API, and STUN/TURN servers (for WebRTC).

## You can find the frontend code [here](https://github.com/LuanNguyenThien/ssmedia-fe)
