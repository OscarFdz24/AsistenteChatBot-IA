let isLoading = false;

function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage(event);
    }
}

function addMessageToChat(text, sender, animate = true) {
    const chatMessages = document.getElementById('chat-messages');
    const welcomeContainer = chatMessages.querySelector('.welcome-container');
    if (welcomeContainer) welcomeContainer.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = sender === 'user' ? 'I' : '🤖';
    
    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    
    if (animate) {
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';
    }
    
    chatMessages.appendChild(messageDiv);
    
    if (animate) {
        setTimeout(() => {
            messageDiv.style.transition = 'all 0.3s ease';
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 10);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendMessage(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();
    if (!messageText) return;
    
    // Add user message to chat
    addMessageToChat(messageText, 'user');
    
    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    
    // Show loading state
    isLoading = true;
    const sendBtn = document.getElementById('send-btn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2" fill="none"/>
        </svg>
    `;
    
    // Send message to server
    fetch('/guest_chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: messageText
        })
    })
    .then(response => response.json())
    .then(data => {
        // Add AI response to chat
        addMessageToChat(data.reply, 'ai');
    })
    .catch(error => {
        console.error('Error:', error);
        addMessageToChat('Lo siento, ocurrió un error al procesar tu mensaje. Por favor, inténtalo de nuevo.', 'ai');
    })
    .finally(() => {
        // Reset loading state
        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        `;
    });
}

// Mobile sidebar functions
function toggleSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('active');
}

function closeSidebar() {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
}
