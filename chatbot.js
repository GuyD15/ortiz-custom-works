// Ortiz Custom Works Chatbot
// Floating widget for customer support and information

const buildApiUrl = (path) => {
  if (typeof window !== 'undefined' && typeof window.apiUrl === 'function') {
    return window.apiUrl(path);
  }
  return path;
};

class WebsiteChatbot {
  constructor() {
    this.isOpen = false;
    this.messages = [];
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.init();
  }

  init() {
    // Inject chatbot HTML and CSS
    this.injectHTML();
    this.injectCSS();
    this.setupEventListeners();
  }

  injectHTML() {
    const chatbotHTML = `
      <div id="chatbot-widget" class="chatbot-widget">
        <!-- Floating Chat Bubble -->
        <div id="chatbot-bubble" class="chatbot-bubble">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span class="notification-dot"></span>
        </div>

        <!-- Chat Window -->
        <div id="chatbot-window" class="chatbot-window hidden">
          <div class="chatbot-header">
            <h3>Chat with us!</h3>
            <button id="chatbot-close" class="close-btn">×</button>
          </div>
          
          <div id="chatbot-messages" class="chatbot-messages">
            <div class="message bot-message">
              <p>Hi! 👋 I'm here to help. Ask me about our services, how to contact us, or anything else!</p>
            </div>
          </div>
          
          <!-- Contact Info Form (Hidden by default) -->
          <div id="chatbot-contact-form" class="chatbot-contact-form hidden">
            <input 
              type="text" 
              id="chatbot-visitor-name" 
              placeholder="Your name"
              autocomplete="off"
            >
            <input 
              type="email" 
              id="chatbot-visitor-email" 
              placeholder="Your email"
              autocomplete="off"
            >
            <textarea 
              id="chatbot-visitor-message" 
              placeholder="Your message for our team..."
              rows="3"
            ></textarea>
            <button id="chatbot-submit-message" class="chatbot-submit-btn">Send Message</button>
            <button id="chatbot-cancel-message" class="chatbot-cancel-btn">Cancel</button>
          </div>

          <div class="chatbot-input-area" id="chatbot-input-area">
        <input 
          type="text" 
          id="chatbot-input" 
          placeholder="Type your question..."
          autocomplete="off"
        >
        <button id="chatbot-send" class="send-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);
  }

  injectCSS() {
    const style = document.createElement('style');
    style.textContent = `
      #chatbot-widget {
        position: fixed;
        bottom: 20px;
        right: 20px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        z-index: 9999;
      }

      .chatbot-bubble {
        width: 56px;
        height: 56px;
        background: #c2410c;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: grab;
        box-shadow: 0 4px 12px rgba(194, 65, 12, 0.3);
        color: white;
        transition: all 0.3s ease;
        position: relative;
      }

      .chatbot-bubble:active {
        cursor: grabbing;
      }

      .chatbot-bubble:hover {
        background: #a0330a;
        transform: scale(1.1);
        box-shadow: 0 6px 16px rgba(194, 65, 12, 0.4);
      }

      .notification-dot {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 10px;
        height: 10px;
        background: #10b981;
        border-radius: 50%;
        border: 2px solid white;
      }

      .chatbot-window {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 380px;
        height: 500px;
        background: white;
        border-radius: 12px;
        box-shadow: 0 5px 40px rgba(0, 0, 0, 0.16);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .chatbot-window.hidden {
        display: none;
        opacity: 0;
        pointer-events: none;
      }

      .chatbot-header {
        background: #c2410c;
        color: white;
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: grab;
      }

      .chatbot-header:active {
        cursor: grabbing;
      }

      .chatbot-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .close-btn {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
        flex-shrink: 0;
        pointer-events: auto;
      }

      .close-btn:hover {
        transform: rotate(90deg);
      }

      .chatbot-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #f9fafb;
      }

      .message {
        display: flex;
        margin-bottom: 8px;
        animation: slideIn 0.3s ease;
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .bot-message {
        justify-content: flex-start;
      }

      .user-message {
        justify-content: flex-end;
      }

      .message p {
        max-width: 70%;
        padding: 10px 12px;
        border-radius: 12px;
        margin: 0;
        font-size: 14px;
        line-height: 1.4;
        word-wrap: break-word;
      }

      .bot-message p {
        background: #e5e7eb;
        color: #1f2937;
        border-radius: 12px 12px 12px 4px;
      }

      .user-message p {
        background: #c2410c;
        color: white;
        border-radius: 12px 12px 4px 12px;
      }

      .bot-message .link-list {
        background: white;
        border-radius: 12px 12px 12px 4px;
        padding: 8px 0;
        margin: 8px 0;
      }

      .bot-message .link-item {
        padding: 8px 12px;
        cursor: pointer;
        transition: background 0.2s;
        display: block;
        color: #c2410c;
        text-decoration: none;
        font-weight: 500;
        border: none;
        background: none;
        text-align: left;
        width: 100%;
      }

      .bot-message .link-item:hover {
        background: #f3f4f6;
      }

      .chatbot-input-area {
        display: flex;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid #e5e7eb;
        background: white;
      }

      #chatbot-input {
        flex: 1;
        border: 1px solid #d1d5db;
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        transition: border-color 0.2s;
        font-family: inherit;
      }

      #chatbot-input:focus {
        border-color: #c2410c;
        box-shadow: 0 0 0 2px rgba(194, 65, 12, 0.1);
      }

      .send-btn {
        background: #c2410c;
        color: white;
        border: none;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
        flex-shrink: 0;
      }

      .send-btn:hover {
        background: #a0330a;
      }

      .send-btn:active {
        transform: scale(0.95);
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        .chatbot-window {
          width: calc(100vw - 40px);
          height: 60vh;
          max-height: 500px;
        }

        .chatbot-bubble {
          width: 50px;
          height: 50px;
        }
      }

      /* Scrollbar styling */
      .chatbot-messages::-webkit-scrollbar {
        width: 6px;
      }

      .chatbot-messages::-webkit-scrollbar-track {
        background: transparent;
      }

      .chatbot-messages::-webkit-scrollbar-thumb {
        background: #d1d5db;
        border-radius: 3px;
      }

      .chatbot-messages::-webkit-scrollbar-thumb:hover {
        background: #9ca3af;
      }

      .chatbot-contact-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 12px;
        border-top: 1px solid #e5e7eb;
        background: white;
      }

      .chatbot-contact-form.hidden {
        display: none;
      }

      .chatbot-contact-form input,
      .chatbot-contact-form textarea {
        border: 1px solid #d1d5db;
        border-radius: 6px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        outline: none;
        resize: vertical;
      }

      .chatbot-contact-form input:focus,
      .chatbot-contact-form textarea:focus {
        border-color: #c2410c;
        box-shadow: 0 0 0 2px rgba(194, 65, 12, 0.1);
      }

      .chatbot-contact-form textarea {
        min-height: 70px;
      }

      .chatbot-submit-btn,
      .chatbot-cancel-btn {
        padding: 8px 12px;
        border-radius: 6px;
        border: none;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }

      .chatbot-submit-btn {
        background: #c2410c;
        color: white;
      }

      .chatbot-submit-btn:hover {
        background: #a0330a;
      }

      .chatbot-cancel-btn {
        background: #f3f4f6;
        color: #6b7280;
      }

      .chatbot-cancel-btn:hover {
        background: #e5e7eb;
      }

      .chatbot-input-area.hidden {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    const bubble = document.getElementById('chatbot-bubble');
    const closeBtn = document.getElementById('chatbot-close');
    const sendBtn = document.getElementById('chatbot-send');
    const input = document.getElementById('chatbot-input');
    const submitMsgBtn = document.getElementById('chatbot-submit-message');
    const cancelMsgBtn = document.getElementById('chatbot-cancel-message');
    const header = document.querySelector('.chatbot-header');

    // Dragging from bubble or header
    bubble.addEventListener('mousedown', (e) => this.startDrag(e));
    header.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Tap to open/close
    bubble.addEventListener('click', () => this.toggleChat());
    
    closeBtn.addEventListener('click', () => this.closeChat());
    sendBtn.addEventListener('click', () => this.sendMessage());
    submitMsgBtn.addEventListener('click', () => this.submitVisitorMessage());
    cancelMsgBtn.addEventListener('click', () => this.cancelMessage());
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });
  }

  startDrag(e) {
    this.isDragging = true;
    const widget = document.getElementById('chatbot-widget');
    const rect = widget.getBoundingClientRect();
    this.dragOffset.x = e.clientX - rect.left;
    this.dragOffset.y = e.clientY - rect.top;
  }

  drag(e) {
    if (!this.isDragging) return;
    const widget = document.getElementById('chatbot-widget');
    let x = e.clientX - this.dragOffset.x;
    let y = e.clientY - this.dragOffset.y;

    // Keep widget within viewport
    const maxX = window.innerWidth - widget.offsetWidth;
    const maxY = window.innerHeight - widget.offsetHeight;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    widget.style.position = 'fixed';
    widget.style.left = x + 'px';
    widget.style.top = y + 'px';
    widget.style.right = 'auto';
    widget.style.bottom = 'auto';
  }

  stopDrag() {
    this.isDragging = false;
  }

  toggleChat() {
    this.isOpen ? this.closeChat() : this.openChat();
  }

  openChat() {
    this.isOpen = true;
    document.getElementById('chatbot-window').classList.remove('hidden');
    document.getElementById('chatbot-input').focus();
  }

  closeChat() {
    this.isOpen = false;
    document.getElementById('chatbot-window').classList.add('hidden');
  }

  showMessageForm() {
    document.getElementById('chatbot-input-area').classList.add('hidden');
    document.getElementById('chatbot-contact-form').classList.remove('hidden');
    document.getElementById('chatbot-visitor-name').focus();
  }

  cancelMessage() {
    document.getElementById('chatbot-contact-form').classList.add('hidden');
    document.getElementById('chatbot-input-area').classList.remove('hidden');
    document.getElementById('chatbot-input').focus();
  }

  async submitVisitorMessage() {
    const name = document.getElementById('chatbot-visitor-name').value.trim();
    const email = document.getElementById('chatbot-visitor-email').value.trim();
    const message = document.getElementById('chatbot-visitor-message').value.trim();

    if (!name || !email || !message) {
      this.addMessage('Please fill in all fields (name, email, and message)', 'bot');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.addMessage('Please enter a valid email address', 'bot');
      return;
    }

    try {
      // Send to backend
      const response = await fetch(buildApiUrl('/api/chatbot-message'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitorName: name, visitorEmail: email, message })
      });

      const data = await response.json();

      if (data.success) {
        this.addMessage('✅ Message sent! Our team will get back to you within 24 hours.', 'bot');
        this.cancelMessage();
        document.getElementById('chatbot-visitor-name').value = '';
        document.getElementById('chatbot-visitor-email').value = '';
        document.getElementById('chatbot-visitor-message').value = '';
      } else {
        this.addMessage('⚠️ There was an error sending your message. Please try again or call us at (407) 676-3102.', 'bot');
      }
    } catch (error) {
      console.error('Chatbot message error:', error);
      this.addMessage('⚠️ There was an error sending your message. Please contact us directly at (407) 676-3102.', 'bot');
    }
  }

  sendMessage() {
    const input = document.getElementById('chatbot-input');
    const message = input.value.trim();

    if (!message) return;

    // Add user message
    this.addMessage(message, 'user');
    input.value = '';

    // Get bot response
    setTimeout(() => {
      const response = this.getResponse(message);
      this.addMessage(response.text, 'bot', response.links);
      
      // Log interaction for analytics (fire and forget)
      fetch(buildApiUrl('/api/log-chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: message,
          botResponse: response.text,
          responseType: response.action || 'standard'
        })
      }).catch(() => {}); // Silently fail if endpoint not available
      
      // If response has an action, execute it
      if (response.action === 'show-message-form') {
        this.showMessageForm();
      }
    }, 300);
  }

  addMessage(text, sender, links = null) {
    const messagesDiv = document.getElementById('chatbot-messages');
    const messageEl = document.createElement('div');
    messageEl.className = `message ${sender}-message`;

    const msgContent = document.createElement('p');
    msgContent.textContent = text;
    messageEl.appendChild(msgContent);

    if (links && links.length > 0) {
      const linkList = document.createElement('div');
      linkList.className = 'link-list';
      links.forEach(link => {
        const linkBtn = document.createElement('button');
        linkBtn.className = 'link-item';
        linkBtn.textContent = link.text;
        linkBtn.onclick = () => window.location.href = link.url;
        linkList.appendChild(linkBtn);
      });
      messageEl.appendChild(linkList);
    }

    messagesDiv.appendChild(messageEl);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  getResponse(message) {
    const msg = message.toLowerCase();

    // Special properties (lakefront, unique homes, docks) - CHECK FIRST
    if (msg.includes('lakefront') || msg.includes('waterfront') || msg.includes('dock') || (msg.includes('special') && (msg.includes('property') || msg.includes('home'))) || (msg.includes('unique') && (msg.includes('property') || msg.includes('home') || msg.includes('space')))) {
      return {
        text: "We're capable of handling custom projects in any home type! Whether it's a traditional home, lakefront property, waterfront residence, condo, or any other unique space, we have the expertise to create beautiful custom solutions. We even specialize in custom docks for waterfront properties! Let's discuss your specific needs!",
        links: [{ text: '→ Request Quote', url: '/contact.html' }]
      };
    }

    // Pricing
    if (msg.includes('price') || msg.includes('cost') || msg.includes('how much') || msg.includes('afford') || msg.includes('budget') || msg.includes('cheap') || msg.includes('expensive')) {
      return {
        text: "Great question! We pride ourselves on offering some of the lowest prices in town while maintaining premium quality. Every project is custom, so costs vary based on your needs. Schedule a free consultation to get an accurate quote tailored to your project.",
        links: [{ text: '→ Free Consultation', url: '/contact.html' }]
      };
    }

    // Custom Closets
    if (msg.includes('closet')) {
      return {
        text: "We specialize in custom closets! We offer walk-ins, reach-ins, and built-ins with premium lighting and finishes. Whether you need more organization or a complete closet redesign, we can help!",
        links: [{ text: '→ View Our Services', url: '/services.html#closets' }]
      };
    }

    // Kitchen & Bath Cabinets
    if (msg.includes('kitchen') || msg.includes('bathroom') || (msg.includes('bath') && !msg.includes('bathrobe'))) {
      return {
        text: "We offer full kitchen and bathroom remodels with beautiful custom cabinetry. From cabinet design to complete renovations, our expert craftsmanship transforms your spaces.",
        links: [{ text: '→ View Our Services', url: '/services.html#kitchen-bath' }]
      };
    }

    // Entertainment & Office Built-Ins
    if (msg.includes('entertainment') || msg.includes('office') || msg.includes('media') || msg.includes('built-in')) {
      return {
        text: "We design and build custom entertainment centers and home offices tailored to your lifestyle. From home theaters to executive workspaces, we create beautiful functional areas.",
        links: [{ text: '→ View Our Services', url: '/services.html#entertainment' }]
      };
    }

    // Staircase - Stain matching (CHECK BEFORE GARAGE since it mentions "floors")
    if ((msg.includes('stair') || msg.includes('railing')) && (msg.includes('stain') || msg.includes('match') || msg.includes('color') || msg.includes('hardwood') || msg.includes('flooring'))) {
      return {
        text: "Absolutely! We'll certainly work to match the stain coloring of your new stairs to your existing hardwood floors. Color matching is one of our specialties to ensure a seamless, professional look throughout your home.",
        links: [{ text: '→ Request Consultation', url: '/contact.html' }]
      };
    }

    // Staircase (general)
    if (msg.includes('staircase') || msg.includes('stair') || msg.includes('railing')) {
      return {
        text: "We design and build stunning custom staircases and railings that wow. From elegant designs to modern styles, we create stunning focal points for your home.",
        links: [{ text: '→ View Our Services', url: '/services.html#staircase' }]
      };
    }

    // Garage Organization
    if (msg.includes('garage') || msg.includes('storage') || msg.includes('organization') || msg.includes('epoxy')) {
      return {
        text: "Our garage organization solutions include heavy-duty cabinets, tool storage, and custom workbenches. We offer full garage makeovers with epoxy floors, custom storage systems, and complete transformations. We'll turn your garage into an organized, functional space you'll love!",
        links: [{ text: '→ View Our Services', url: '/services.html#garage' }]
      };
    }

    // Service inquiries (general)
    if (msg.includes('service') || msg.includes('what do you') || msg.includes('offer') || msg.includes('do you do')) {
      return {
        text: "We offer custom spaces including: Custom Closets, Kitchen & Bath Cabinets, Entertainment & Office Built-Ins, Garage Organization, Bathroom & Laundry, and Staircase Remodels. What interests you?",
        links: [{ text: '→ View All Services', url: '/services.html' }]
      };
    }

    // Contact information
    if (msg.includes('contact') || msg.includes('phone') || msg.includes('call') || msg.includes('reach')) {
      return {
        text: "You can reach us at (407) 676-3102 or fill out our contact form. We'd love to hear from you!",
        links: [{ text: '→ Contact Us', url: '/contact.html' }]
      };
    }

    // Hours - responsive based on current time
    if (msg.includes('hour') || msg.includes('open') || msg.includes('available')) {
      return {
        text: "We're available weekdays during business hours. Feel free to call us at (407) 676-3102 or send a message anytime!",
        links: [{ text: '→ Send Message', url: '/contact.html' }]
      };
    }

    // Payment/billing
    if (msg.includes('pay') || msg.includes('bill') || msg.includes('invoice') || msg.includes('payment')) {
      return {
        text: "You can securely pay your invoices online through our payment portal. It's quick and easy!",
        links: [{ text: '→ Pay Your Bill', url: '/pay-bill.html' }]
      };
    }

    // Gallery/portfolio
    if (msg.includes('portfolio') || msg.includes('gallery') || msg.includes('project') || msg.includes('work') || msg.includes('photos')) {
      return {
        text: "Check out our portfolio to see examples of our custom renovation work!",
        links: [{ text: '→ View Gallery', url: '/gallery.html' }]
      };
    }

    // About company
    if (msg.includes('about') || msg.includes('who are you') || msg.includes('company') || msg.includes('experience')) {
      return {
        text: "Learn more about Ortiz Custom Works and our commitment to quality craftsmanship.",
        links: [{ text: '→ About Us', url: '/about.html' }]
      };
    }

    // Reviews
    if (msg.includes('review') || msg.includes('testimonial') || msg.includes('rating')) {
      return {
        text: "See what our satisfied customers have to say about working with us!",
        links: [{ text: '→ See Reviews', url: '/reviews.html' }]
      };
    }

    // Consultation
    if (msg.includes('consult') || msg.includes('free') || msg.includes('quote') || msg.includes('estimate')) {
      return {
        text: "We offer free consultations! Get in touch with our team to discuss your project.",
        links: [{ text: '→ Request Consultation', url: '/contact.html' }]
      };
    }

    // Common variations
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return {
        text: "Hi there! 👋 How can I help you today? Feel free to ask about our services, how to contact us, or anything else!"
      };
    }

    if (msg.includes('help') || msg.includes('?')) {
      return {
        text: "I can help you with information about our services (closets, kitchens, bathrooms, built-ins, garages, and staircases), contact details, how to pay a bill, view our portfolio, and more. What would you like to know?"
      };
    }

    // Message sending
    if (msg.includes('message') || msg.includes('mail') || msg.includes('email me') || msg.includes('contact me')) {
      return {
        text: "I'd be happy to help pass a message to our team! What would you like to say?",
        action: 'show-message-form'
      };
    }

    // Default response with fallback to email
    return {
      text: "I couldn't quite find the answer to that. Would you like to send a message to our team?",
      action: 'show-message-form'
    };
  }
}

// Initialize chatbot when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new WebsiteChatbot();
  });
} else {
  new WebsiteChatbot();
}
