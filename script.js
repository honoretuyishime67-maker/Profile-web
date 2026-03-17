const videos = [
  { id: 'yvzLHXqcanQ' },
  { id: 'glsbQJfo4T8' },
  { id: '8_UyFSrQblc' },
  { id: 'jPFDwkthyaA' },
];

// Global state for chat personalization and memory
let chatState = {
  userRole: null, // 'teacher', 'student', 'collaborator', or null
  uploadedDocuments: [],
  conversationLength: 0
};

const videoGrid = document.getElementById('video-grid');
const ytPlayer = document.getElementById('yt-player');
const nowPlaying = document.getElementById('now-playing');

function setNowPlaying(title) {
  nowPlaying.textContent = `Now Playing: ${title}`;
}

async function fetchTitle(videoId) {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('oEmbed fetch failed');
    const data = await response.json();
    return data.title;
  } catch {
    return 'Ministry Video';
  }
}

function createCard(video) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'video-card';
  button.dataset.videoId = video.id;
  button.setAttribute('aria-label', 'Play video');

  const thumb = document.createElement('div');
  thumb.className = 'video-thumb';
  thumb.style.backgroundImage = `url('https://img.youtube.com/vi/${video.id}/hqdefault.jpg')`;

  const meta = document.createElement('div');
  meta.className = 'video-meta';
  meta.innerHTML = `
    <span class="video-title">Loading title…</span>
    <span class="video-desc">Click to play</span>
  `;

  button.appendChild(thumb);
  button.appendChild(meta);

  fetchTitle(video.id).then((title) => {
    const titleEl = meta.querySelector('.video-title');
    if (titleEl) {
      titleEl.textContent = title;
      button.setAttribute('aria-label', `Play video: ${title}`);
    }
    video.title = title;
  });

  return button;
}

function loadVideo(videoId) {
  ytPlayer.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;

  const current = videos.find((v) => v.id === videoId);
  if (current && current.title) {
    setNowPlaying(current.title);
  }
}

async function initVideos() {
  videos.forEach((video) => {
    videoGrid.appendChild(createCard(video));
  });

  if (videos.length) {
    const first = videos[0];
    const title = await fetchTitle(first.id);
    first.title = title;
    setNowPlaying(title);
    loadVideo(first.id);
  }

  videoGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.video-card');
    if (!card) return;
    const videoId = card.dataset.videoId;
    if (!videoId) return;

    loadVideo(videoId);
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

initVideos();

function appendChatMessage(text, sender) {
  const container = document.getElementById('ai-messages');
  if (!container) return;

  const message = document.createElement('div');
  message.className = `ai-message ${sender}`;
  message.textContent = text;
  container.appendChild(message);
  container.scrollTop = container.scrollHeight;

  // Track conversation length
  if (sender === 'user' || sender === 'bot') {
    chatState.conversationLength++;
  }
}

// Create message for bot messages (simple bubble)
function createBotMessage(text) {
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'ai-message-wrapper bot-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'ai-message-bubble bot';
  bubble.innerHTML = text;

  messageWrapper.appendChild(bubble);
  return messageWrapper;
}

// Create message for user messages
function createUserMessage(text) {
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'ai-message-wrapper user-wrapper';
  
  const bubble = document.createElement('div');
  bubble.className = 'ai-message-bubble user';
  bubble.textContent = text;
  
  messageWrapper.appendChild(bubble);
  
  return messageWrapper;
}

// Enhanced append message with proper structure
function appendChatMessageEnhanced(text, sender) {
  const container = document.getElementById('ai-messages');
  if (!container) return;

  let messageElement;
  if (sender === 'bot') {
    messageElement = createBotMessage(text);
  } else {
    messageElement = createUserMessage(text);
  }

  container.appendChild(messageElement);
  container.scrollTop = container.scrollHeight;

  if (sender === 'user' || sender === 'bot') {
    chatState.conversationLength++;
  }
}

// Set user role and notify server
async function setUserRole(role) {
  chatState.userRole = role;
  
  try {
    await fetch('http://localhost:3000/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    
    let roleLabel = 'General visitor';
    if (role === 'teacher') roleLabel = 'Educator';
    if (role === 'student') roleLabel = 'Student/Learner';
    if (role === 'collaborator') roleLabel = 'Collaborator';
    
    console.log(`Role set to: ${roleLabel}`);
    
    // Optional: show a brief confirmation
    const roleEl = document.getElementById('ai-user-role');
    if (roleEl) {
      roleEl.textContent = `Role: ${roleLabel}`;
    }
  } catch (error) {
    console.error('Error setting role:', error);
  }
}

// Get conversation info from server
async function getConversationInfo() {
  try {
    const response = await fetch('http://localhost:3000/conversation-info');
    const info = await response.json();
    return info;
  } catch (error) {
    console.error('Error getting conversation info:', error);
    return null;
  }
}

function getFallbackResponse(message) {
  const lower = message.trim().toLowerCase();
  
  // Fallback responses follow the same structure: Understanding → Reasoning → Answer → Next Steps
  const patterns = [
    { 
      test: /\b(hi|hello|hey)\b/, 
      reply: `**Welcome!** I'm Honore's AI assistant. 

**How I can help:**
I reason through your questions about education, technology, learning strategies, and how to connect with Honore's work. I also learn from documents you share.

**Next Step:** Ask me anything about Honore's background, projects, or how ICT & education intersect.` 
    },
    { 
      test: /\b(cv|resume|background|experience|qualification)\b/, 
      reply: `**Understanding:** You'd like to know about Honore's qualifications and experience.

**My Background Summary:**
- **Teacher** at Rukara Model School of Sciences and Mathematics (Rwanda's premier institution)
- **Student** in Computer Science & Physics Education at ULK Gisenyi Campus
- **ICT Trainer** with PiSquare (Edify-supported), empowering 100+ teachers with digital literacy
- **Ministry Work** in spiritual education and community transformation in Rwanda

**Next Step:** Explore the About or Development pages for deeper details, or ask about a specific area.`
    },
    { 
      test: /\b(projects?|portfolio|work|build)\b/, 
      reply: `**Understanding:** You're interested in what I've built and accomplished.

**My Project Focus:**
I work at the intersection of education and technology:
- AI automation tools for teacher workflows
- Digital literacy training (50+ teachers trained)
- Lesson planning resources for STEM education
- Education tech integration strategies for Rwanda

**Next Step:** Visit the Projects page for case studies, or upload a document so I can discuss specifics in depth.` 
    },
    { 
      test: /\b(ai|automation|machine learning|ml|robot)\b/, 
      reply: `**Understanding:** You're curious about AI and automation.

**My Perspective:**
AI isn't magic—it's a tool. I believe in:
1. **Understanding the "why"** before deploying automation
2. **Keeping humans in the loop** (especially in education)
3. **Using AI to amplify human capability**, not replace it
4. **Being transparent** about what AI can and can't do

**Practical Application in Education:**
AI can help teachers save time on grading, planning, and admin—freeing them for what matters: connecting with students.

**Next Step:** Ask how AI could help with your specific challenge.` 
    },
    { 
      test: /\b(education|teaching|teacher|student|learning|school)\b/, 
      reply: `**Understanding:** You're interested in education and how I approach it.

**My Core Belief:**
Technology should serve education, not replace human connection. Good teaching combines:
- Clear reasoning and structure
- Empathy for learner challenges  
- Practical, actionable guidance
- Honesty about what we don't know

**How I Help:**
I design lessons, explain concepts step-by-step, and provide tools that teachers can actually use (not just theory).

**Next Step:** Ask me about a specific teaching challenge or topic you're exploring.` 
    },
    { 
      test: /\b(contact|email|phone|reach|connect|collaboration|partner)\b/, 
      reply: `**Understanding:** You'd like to connect or collaborate.

**Contact Information:**
- **Email:** tuyishimehonore63@gmail.com
- **Phone:** +250 791 684 429
- **LinkedIn & Social:** Links in the footer

**Why Reach Out:**
Honore collaborates on:
- Teacher training & digital literacy programs
- Education technology projects
- Ministry partnerships
- Teaching method innovation

**Next Step:** Send an email with your idea or question—Honore responds thoughtfully and promptly.` 
    },
    { 
      test: /\b(help|guide|how|what|why|explain|learn)\b/, 
      reply: `**Understanding:** You need guidance or explanation on something.

**My Approach:**
I break complex questions into smaller parts, show my reasoning step-by-step, ground answers in evidence, and always provide practical next steps. I'm here to help you understand, not just give quick answers.

**For Best Results:**
- Ask clearly what you're trying to accomplish
- Share context about your situation
- Upload documents if you want me to reference specific materials

**Next Step:** Go ahead—ask your real question. I'm listening.` 
    },
  ];

  for (const entry of patterns) {
    if (entry.test.test(lower)) return entry.reply;
  }

  return `**I may not have full context right now, but I can still help.**

**My Process:**
1. I listen carefully to what you're really asking
2. I think through the reasoning step-by-step
3. I give you a clear answer grounded in evidence
4. I suggest practical next steps

**To get the most from me:**
- Ask about Honore's education, projects, AI work, or how to connect
- Share documents so I can reference specifics
- Be honest about what you're trying to accomplish

**What I can help with:**
- Understanding technology and education
- Problem-solving for learning/teaching challenges
- Connecting you with Honore's work and expertise

**Next Step:** Ask me your real question, and I'll show you my thinking.`;
}

async function getChatResponse(message) {
  try {
    const response = await fetch('http://localhost:3000/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        message,
        userRole: chatState.userRole
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Update local state if role was detected
    if (data.detectedRole && !chatState.userRole) {
      chatState.userRole = data.detectedRole;
      const roleEl = document.getElementById('ai-user-role');
      if (roleEl) {
        roleEl.textContent = `Inferred Role: ${data.detectedRole}`;
      }
    }

    return data.response || getFallbackResponse(message);
  } catch (error) {
    console.warn('AI service unavailable, using fallback responses.', error);
    return getFallbackResponse(message);
  }
}

function initChat() {
  const widget = document.getElementById('ai-widget');
  const toggle = document.getElementById('ai-toggle');
  const closeBtn = document.getElementById('ai-close');
  const form = document.getElementById('ai-form');
  const input = document.getElementById('ai-input');

  if (!widget || !form || !input || !toggle) return;

  function openWidget() {
    widget.classList.add('open');
    widget.classList.remove('collapsed');
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();
  }

  function closeWidget() {
    widget.classList.remove('open');
    widget.classList.add('collapsed');
    toggle.setAttribute('aria-expanded', 'false');
  }

  // Start collapsed; show greeting when the user opens the chat.
  let firstOpen = true;

  // Make toggle button use a small avatar when collapsed
  if (!toggle.querySelector('.ai-avatar-mini')) {
    const avatar = document.createElement('img');
    avatar.src = 'profile.jpg';
    avatar.alt = 'AI chat';
    avatar.className = 'ai-avatar-mini';

    const text = document.createElement('span');
    text.className = 'ai-toggle-text';
    text.textContent = 'Chart with Honore';

    toggle.textContent = '';
    toggle.appendChild(avatar);
    toggle.appendChild(text);
  }

  function openWidget() {
    widget.classList.add('open');
    widget.classList.remove('collapsed');
    toggle.setAttribute('aria-expanded', 'true');
    input.focus();

    if (firstOpen) {
      appendChatMessageEnhanced('Hello! I\'m Honore\'s AI assistant. I learn from our conversation and documents you share. Who are you? (Teacher? Student? Collaborator?)', 'bot');
      firstOpen = false;
    }
  }

  // Keep widget collapsed on load; expand only when the user clicks.
  toggle.addEventListener('click', () => {
    if (widget.classList.contains('open')) {
      closeWidget();
    } else {
      openWidget();
    }
  });

  closeBtn?.addEventListener('click', closeWidget);

  // Add role selector if not already present
  const aiHeader = document.querySelector('.ai-header');
  if (aiHeader && !document.getElementById('ai-role-selector')) {
    const roleSelector = document.createElement('div');
    roleSelector.id = 'ai-role-selector';
    roleSelector.style.cssText = 'margin: 10px 0; display: flex; gap: 5px; flex-wrap: wrap; font-size: 12px;';
    
    const roles = [
      { value: null, label: 'General' },
      { value: 'teacher', label: '👨‍🏫 Teacher' },
      { value: 'student', label: '👨‍🎓 Student' },
      { value: 'collaborator', label: '🤝 Collaborator' }
    ];
    
    roles.forEach(role => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = role.label;
      btn.style.cssText = `
        padding: 5px 10px; 
        border: 1px solid #ccc; 
        border-radius: 3px; 
        background: ${chatState.userRole === role.value ? '#007bff' : '#f5f5f5'};
        color: ${chatState.userRole === role.value ? 'white' : 'black'};
        cursor: pointer;
        font-size: 12px;
      `;
      btn.onclick = () => {
        setUserRole(role.value);
        // Update button styles
        document.querySelectorAll('#ai-role-selector button').forEach(b => {
          b.style.background = '#f5f5f5';
          b.style.color = 'black';
        });
        btn.style.background = '#007bff';
        btn.style.color = 'white';
      };
      roleSelector.appendChild(btn);
    });
    
    aiHeader.parentNode.insertBefore(roleSelector, aiHeader.nextSibling);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) return;

    appendChatMessageEnhanced(value, 'user');
    input.value = '';
    input.disabled = true;

    try {
      const response = await getChatResponse(value);
      appendChatMessageEnhanced(response, 'bot');
    } catch (error) {
      appendChatMessageEnhanced('Sorry, there was an error. Please try again.', 'bot');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });

  const fileInput = document.getElementById('ai-file');
  const fileStatus = document.getElementById('ai-file-status');

  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      fileStatus.textContent = 'Uploading...';

      const formData = new FormData();
      formData.append('document', file);

      try {
        const resp = await fetch('http://localhost:3000/upload', {
          method: 'POST',
          body: formData
        });

        const result = await resp.json();
        if (resp.ok) {
          chatState.uploadedDocuments = result.documents || [];
          fileStatus.textContent = `✓ "${file.name}" uploaded. I'll reference it in my answers.`;
          
          // Optional: notify user in chat
          appendChatMessageEnhanced(`I've loaded your document: "${file.name}". Feel free to ask me questions about it!`, 'bot');
        } else {
          fileStatus.textContent = result.error || 'Upload failed.';
        }
      } catch (err) {
        fileStatus.textContent = 'Upload failed (network error).';
      }

      // Reset file input
      fileInput.value = '';
    });
  }
}

initChat();


initChat();

const quotes = [
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela" },
  { text: "Technology will not replace great teachers, but technology in the hands of great teachers can be transformational.", author: "George Couros" },
  { text: "The future of education is not in the classroom; it is in the connections we build and the digital tools we harness.", author: "Tuyishime Honore" },
  { text: "When we teach computers to learn, we must also teach learners to think.", author: "Unknown" },
  { text: "Every student can learn, just not on the same day, or the same way.", author: "George Evans" },
  { text: "The best way to predict the future is to create it.", author: "Peter Drucker" },
  { text: "Learning is not a spectator sport.", author: "D. Blocher" },
  { text: "Tell me and I forget. Teach me and I remember. Involve me and I learn.", author: "Benjamin Franklin" },
  { text: "Digital learning is not about technology; it’s about empowering learners.", author: "Unknown" },
  { text: "Coding is today’s language of creativity.", author: "Unknown" },
  { text: "The important thing is not to stop questioning. Curiosity has its own reason for existing.", author: "Albert Einstein" },
  { text: "Teaching is the one profession that creates all other professions.", author: "Unknown" },
  { text: "You don’t have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "The role of a teacher is to create the conditions for invention rather than provide ready-made knowledge.", author: "Seymour Papert" },
  { text: "Access to technology is not enough. It must be backed by good teaching.", author: "Unknown" },
  { text: "A child’s mind is not a vessel to be filled but a fire to be kindled.", author: "Dorothy Butler" },
  { text: "Learning is not a place; it is a process.", author: "G. K. Chesterton" },
  { text: "The function of education is to teach one to think intensively and to think critically.", author: "Martin Luther King Jr." },
  { text: "When learning becomes a habit, success becomes a tradition.", author: "Unknown" },
  { text: "Every problem is a gift—without problems we would not grow.", author: "Anthony Robbins" },
  { text: "Digital skills are the currency of the 21st century.", author: "Unknown" },
  { text: "Curiosity is the wick in the candle of learning.", author: "William Arthur Ward" },
  { text: "Great teachers empathize with children, respect them, and believe that each one has something special that can be built upon.", author: "Ann Lieberman" },
  { text: "Education is the passport to the future, for tomorrow belongs to those who prepare for it today.", author: "Malcolm X" },
  { text: "Students don’t care how much you know until they know how much you care.", author: "John C. Maxwell" },
  { text: "Technology alone won’t fix education, but well-used technology can open doors.", author: "Unknown" },
  { text: "Learning is a treasure that will follow its owner everywhere.", author: "Chinese Proverb" },
  { text: "The greatest sign of success for a teacher is to be able to say, 'The children are now working as if I did not exist.'", author: "Maria Montessori" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "A teacher affects eternity; he can never tell where his influence stops.", author: "Henry Adams" },
  { text: "The more that you read, the more things you will know. The more that you learn, the more places you’ll go.", author: "Dr. Seuss" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci" },
  { text: "To teach is to learn twice.", author: "Joseph Joubert" },
  { text: "Good teaching is more a giving of right questions than a giving of right answers.", author: "Josef Albers" },
  { text: "Every child deserves a champion: an adult who will never give up on them.", author: "Rita Pierson" },
  { text: "Education is not preparation for life; education is life itself.", author: "John Dewey" },
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King" },
  { text: "Innovation is the ability to see change as an opportunity, not a threat.", author: "Steve Jobs" },
  { text: "A great teacher takes a hand, opens a mind, and touches a heart.", author: "Unknown" },
  { text: "Programming today is a race between software engineers trying to build bigger and better idiot-proof programs, and the Universe trying to build bigger and better idiots.", author: "Rick Cook" },
  { text: "The most valuable resource that all teachers have is each other. Without collaboration our growth is limited to our own perspectives.", author: "Robert John Meehan" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "The greatest learning happens outside the classroom when we apply what we know.", author: "Unknown" },
  { text: "Technology is best when it brings people together.", author: "Matt Mullenweg" },
  { text: "Learning is the only thing the mind never exhausts, never fears, and never regrets.", author: "Leonardo da Vinci" },
  { text: "The purpose of education is to replace an empty mind with an open one.", author: "Malcolm Forbes" },
  { text: "Excellence is not a destination; it is a continuous journey that never ends.", author: "Brian Tracy" },
  { text: "You don’t learn to walk by following rules. You learn by doing, and by falling over.", author: "Richard Branson" },
  { text: "If you can dream it, you can do it.", author: "Walt Disney" },
  { text: "Learning is a lifelong process, and the best teachers are the ones who keep learning.", author: "Unknown" },
];

const quoteText = document.getElementById('rotator-text');
const quoteAuthor = document.getElementById('rotator-author');
const quoteCounter = document.getElementById('quote-counter');
const prevBtn = document.getElementById('quote-prev');
const nextBtn = document.getElementById('quote-next');

let quoteIndex = 0;

function renderQuote(index) {
  const quote = quotes[index];
  quoteText.textContent = `“${quote.text}”`;
  quoteAuthor.textContent = `— ${quote.author}`;
  quoteCounter.textContent = `${index + 1} / ${quotes.length}`;
}

function showNextQuote() {
  quoteIndex = (quoteIndex + 1) % quotes.length;
  renderQuote(quoteIndex);
}

function showPrevQuote() {
  quoteIndex = (quoteIndex - 1 + quotes.length) % quotes.length;
  renderQuote(quoteIndex);
}

prevBtn.addEventListener('click', showPrevQuote);
nextBtn.addEventListener('click', showNextQuote);

renderQuote(0);