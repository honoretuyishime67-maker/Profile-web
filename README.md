# Tuyishime Honore Portfolio Site

A multi-page portfolio website with an AI-powered chat assistant using Groq API.

## Features
- Multi-page site (Home, About, Roles, Development, Education, Projects, Vision, Ministry, Contact)
- Interactive AI chat widget with live chart
- YouTube video integration
- Responsive design

## Setup

### Prerequisites
- Node.js (download from https://nodejs.org/)
- npm (comes with Node.js)

### Installation
1. Install dependencies:
   ```
   npm install
   ```

2. Start the backend server:
   ```
   npm start
   ```
   This will start the server on http://localhost:3000

3. Open any HTML file (e.g., index.html) in your browser to view the site.

## How it works
- The frontend is static HTML/CSS/JS
- The AI chat calls the local backend server, which proxies requests to Groq API
- The API key is securely stored on the server (not exposed to the browser)

## Troubleshooting
- If the chat doesn't work, ensure the server is running on port 3000
- Check browser console for errors
- Make sure Node.js and npm are installed