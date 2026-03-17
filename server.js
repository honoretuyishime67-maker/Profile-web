const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
const multer = require('multer');
const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;

// Load CV data from JSON file
let cvData = null;
try {
  const cvPath = path.join(__dirname, 'cv-data.json');
  const cvContent = fs.readFileSync(cvPath, 'utf8');
  cvData = JSON.parse(cvContent);
  console.log('✓ CV data loaded successfully');
} catch (error) {
  console.warn('⚠ CV data file not found or invalid. Running without embedded CV context.');
}

// Initialize Groq client with the provided API key
const groq = new Groq({
  apiKey: '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'
});

// Store the latest uploaded document text to include in AI context
let uploadedDocumentText = '';

// Conversation memory: store up to 20 most recent messages per session
let conversationHistory = [];
const MAX_HISTORY = 20;

// Document tracking: store metadata about uploaded documents
let uploadedDocuments = [];

// Session tracking for personalization
let userProfile = {
  role: null, // 'teacher', 'student', 'collaborator', or null
  lastUpdate: Date.now()
};

const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// Function to detect user role from conversation context
function detectUserRole(messages) {
  const recentText = messages.slice(-5).map(m => m.content).join(' ').toLowerCase();
  
  if (/\b(teach|classroom|student|lesson|course|grading|curriculum)\b/.test(recentText)) {
    return 'teacher';
  }
  if (/\b(learn|study|assignment|exam|understand|help me|question)\b/.test(recentText)) {
    return 'student';
  }
  if (/\b(collaborat|partner|project|implement|develop|train)\b/.test(recentText)) {
    return 'collaborator';
  }
  return null;
}

// Domain-specific system prompts with comprehensive CV data
function getSystemPrompt(userRole, documentContext) {
  // Build comprehensive CV context
  let cvContext = '';
  if (cvData) {
    const exp = cvData.professionalExperience[0]; // Current role
    const edu = cvData.education[0]; // Current education
    const skills = Object.keys(cvData.computerSkills).join(', ');
    
    cvContext = `

**COMPREHENSIVE BACKGROUND (from verified CV):**

📚 **Current Education:**
- Bachelor of Education in Computer Science and Physics (CSP) - ULK Kigali Independent University (2024-Present)

👨‍🏫 **Current Position:**
- Teacher of STEM subjects at Rukara Model School of Sciences and Mathematics (Sept 2024 - Present)
- ICT Trainer with PISQUARE/Edify for primary school teachers (Nov 2025 - Present)

📚 **Educational Journey:**
- A2 Diploma in Teaching (2020-2023, TTC Matimba)
- Primary Teaching Residency Program (2023-2024, TTC De La Salle) - Certificate of Completion
- O-Level Certificate (2017-2019)
- Complete teaching qualification pathway

💻 **Technical Skills:**
- Web Development: HTML5, CSS3, JavaScript, PHP, MySQL, Laravel, Bootstrap, Joomla, WordPress
- Programming: Scratch, Turtle Art, jQuery
- Educational Platforms: Google Classroom, Microsoft Teams, Kahoot, Quizlet, Khan Academy, GeoGebra, EduPuzzle, Flip Grid, Mentimeter, Plickers
- Office Suite: Word, Excel, PowerPoint, Access, Google Docs/Sheets/Slides
- Media: Video production, image design, certificate design, AI tools for content creation

🗣️ **Languages:**
- English (Excellent in speaking, listening, reading, writing)
- Kinyarwanda (Excellent in all levels)
- French (Good in all levels)

🎓 **Certifications & Training:**
- Primary Teaching Residency Program Certificate (ICT, Methodologies, English)
- EdTech Integration Pilot Training (REB & World Bank)
- CPD-ITMS: ICT in Teaching & Pedagogy (UR Centre of Excellence)
- PISQUARE Trainer Certification (Edify) - ICT Integration in Teaching
- Microsoft Online Course (ALX)

🎯 **Key Strengths:**
${cvData.keyStrengths.map(s => `- ${s}`).join('\n')}

🌟 **Mission:**
${cvData.mission}

📞 **Contact:**
- Phone: +250 791 684 429
- Email: tuyishimehonore63@gmail.com
- Location: Eastern Province, Rwanda`;
  }

  const baseContext = `You are a thoughtful, empathetic AI assistant for Tuyishime Honore's portfolio and learning platform. Your role is to help visitors understand Honore's work and support their learning journey.

**Core Principles:**
- Think critically and reason step-by-step before answering
- Show your reasoning process, not just conclusions  
- Ground answers in evidence (documents shared, Honore's verified CV, provided materials)
- Communicate with warmth and genuine care—avoid robotic patterns
- Always identify the real question behind what users ask
- Provide actionable next steps when possible

**Response Structure (follow this format):**
1. **Understanding** - What I understand your question/need to be (1-2 sentences)
2. **My Reasoning** - How I'm thinking through this (brief, step-by-step)
3. **Answer/Guidance** - Clear, practical response with examples when helpful
4. **Next Steps** - What you might do or ask next (concrete suggestions)

${cvContext}

${documentContext}`;

  // Tailored additions based on user role
  if (userRole === 'teacher') {
    return baseContext + `

**You are speaking with an educator.** Focus on:
- Practical classroom strategies and implementation from Honore's teaching experience
- How to integrate technology without overcomplicating teaching
- Teacher time-management and efficiency gains
- Connecting pedagogy with digital tools
- Real examples from Honore's experience at Rukara Model School
- ICT training approaches Honore uses with 100+ teachers`;
  }
  
  if (userRole === 'student') {
    return baseContext + `

**You are speaking with a learner.** Focus on:
- Clear explanations that build understanding step-by-step
- Encouraging curiosity and deeper learning
- Connecting concepts to real applications
- Empowering independent thinking and problem-solving
- Being patient with questions and providing supportive guidance
- How Honore's approach makes learning accessible and inspiring`;
  }
  
  if (userRole === 'collaborator') {
    return baseContext + `

**You are speaking with a potential partner/collaborator.** Focus on:
- Honore's proven track record: PISQUARE trainer, model school teacher, certified in EdTech
- Concrete collaboration opportunities in education tech, teacher training, or innovation
- Scalable solutions and implementation ideas with demonstrated impact
- Honore's verifiable credentials and partnerships (REB, World Bank, TTC institutions)
- Clear next steps for potential partnership - direct contact info available`;
  }

  return baseContext + `

Keep responses focused, warm, and actionable. Explain reasoning transparently. Reference Honore's verified CV when appropriate.`;
}

// Function to extract relevant context from uploaded document based on question
function extractRelevantContext(documentText, userMessage) {
  if (!documentText) return '';
  
  const keywords = userMessage.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const lines = documentText.split('\n');
  
  const relevantLines = lines.filter(line => {
    const lineLower = line.toLowerCase();
    return keywords.some(keyword => lineLower.includes(keyword));
  });
  
  if (relevantLines.length > 0) {
    return relevantLines.slice(0, 10).join('\n').substring(0, 1500);
  }
  return documentText.substring(0, 1000);
}

// Add message to conversation history
function addToHistory(role, content) {
  conversationHistory.push({
    role,
    content,
    timestamp: Date.now()
  });
  
  // Keep only the most recent messages
  if (conversationHistory.length > MAX_HISTORY) {
    conversationHistory = conversationHistory.slice(-MAX_HISTORY);
  }
}

app.post('/chat', async (req, res) => {
  const { message, userRole } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    // Update user profile if role is provided
    if (userRole) {
      userProfile.role = userRole;
      userProfile.lastUpdate = Date.now();
    }

    // Add user message to history
    addToHistory('user', message);

    // Detect role if not explicitly provided
    const detectedRole = userRole || detectUserRole(conversationHistory);
    if (detectedRole && !userProfile.role) {
      userProfile.role = detectedRole;
    }

    const relevantContext = extractRelevantContext(uploadedDocumentText, message);
    
    const documentContextNote = relevantContext 
      ? `\n\n[DOCUMENT REFERENCE AVAILABLE]\nThe user has shared: ${uploadedDocuments.map(d => d.name).join(', ')}\n\nRelevant sections:\n${relevantContext}`
      : '';

    const systemPrompt = getSystemPrompt(userProfile.role, documentContextNote);

    // Build messages array with conversation history
    const messages = conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Ensure system message is included
    const chatMessages = messages.slice(-10); // Use last 10 messages for context window

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        ...chatMessages
      ],
      model: 'llama3-8b-8192',
      temperature: 0.8,
      max_tokens: 500
    });

    const response = chatCompletion.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
    
    // Add assistant response to history
    addToHistory('assistant', response);

    res.json({ 
      response,
      detectedRole: userProfile.role,
      documentsUsed: uploadedDocuments.length > 0
    });
  } catch (error) {
    console.error('Error calling Groq:', error);
    res.status(500).json({ error: 'Failed to get response from AI' });
  }
});

// New endpoint to get conversation summary or reset
app.get('/conversation-info', (req, res) => {
  res.json({
    messageCount: conversationHistory.length,
    userRole: userProfile.role,
    documentsLoaded: uploadedDocuments.length,
    documents: uploadedDocuments.map(d => ({ name: d.name, uploadedAt: d.uploadedAt }))
  });
});

app.post('/reset-conversation', (req, res) => {
  conversationHistory = [];
  res.json({ message: 'Conversation history cleared. Starting fresh!' });
});

app.post('/upload', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const buffer = req.file.buffer;
    let text = '';
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;

    if (req.file.mimetype === 'application/pdf') {
      const data = await pdf(buffer);
      text = data.text;
    } else {
      text = buffer.toString('utf8');
    }

    // Store more content (up to 15000 chars) for better context extraction
    uploadedDocumentText = text.substring(0, 15000);

    // Track document metadata
    const docMetadata = {
      name: fileName,
      type: fileType,
      size: fileSize,
      uploadedAt: new Date().toISOString(),
      charCount: uploadedDocumentText.length,
      usageCount: 0 // Track how many times this doc is referenced in answers
    };
    
    // Replace if document with same name already exists, otherwise add
    const existingIndex = uploadedDocuments.findIndex(d => d.name === fileName);
    if (existingIndex >= 0) {
      uploadedDocuments[existingIndex] = docMetadata;
    } else {
      uploadedDocuments.push(docMetadata);
    }

    // Log the upload for debugging
    console.log(`Document uploaded: ${fileName} (${fileType}), extracted ${uploadedDocumentText.length} characters`);
    console.log(`Total documents in memory: ${uploadedDocuments.length}`);

    res.json({ 
      success: true, 
      message: `Document "${fileName}" successfully loaded. I'll use it for context when answering your questions.`,
      charCount: uploadedDocumentText.length,
      totalDocuments: uploadedDocuments.length,
      documents: uploadedDocuments
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

app.post('/set-role', (req, res) => {
  const { role } = req.body;
  const validRoles = ['teacher', 'student', 'collaborator', null];
  
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Use: teacher, student, collaborator, or null' });
  }
  
  userProfile.role = role;
  userProfile.lastUpdate = Date.now();
  
  let roleDescription = 'General visitor';
  if (role === 'teacher') roleDescription = 'Educator/Teacher';
  if (role === 'student') roleDescription = 'Student/Learner';
  if (role === 'collaborator') roleDescription = 'Collaborator/Partner';
  
  res.json({ 
    message: `Role set to: ${roleDescription}`,
    role: userProfile.role
  });
});

// Serve CV data for reference
app.get('/cv-data', (req, res) => {
  if (cvData) {
    res.json(cvData);
  } else {
    res.status(404).json({ error: 'CV data not available' });
  }
});

// Get CV summary
app.get('/cv-summary', (req, res) => {
  if (cvData) {
    res.json({
      name: cvData.personalInfo.fullName,
      summary: cvData.summary,
      mission: cvData.mission,
      currentRoles: [
        `Teacher at Rukara Model School (Sept 2024-Present)`,
        `ICT Trainer with PISQUARE/Edify (Nov 2025-Present)`
      ],
      education: `Bachelor's in Computer Science & Physics Education (ULK, 2024-Present)`,
      keyStrengths: cvData.keyStrengths,
      contact: {
        email: cvData.personalInfo.email,
        phone: cvData.personalInfo.phone
      }
    });
  } else {
    res.status(404).json({ error: 'CV data not available' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});