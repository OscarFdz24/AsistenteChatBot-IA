let currentConversationId = null;
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

function createNewChat() {
    currentConversationId = null;
    document.getElementById('chat-title').textContent = 'VirtualGPT';
    document.getElementById('chat-messages').innerHTML = `
        <div class="welcome-container">
            <div class="welcome-icon">💬</div>
            <h2>¿Cómo puedo ayudarte hoy?</h2>
        </div>
    `;
    
    // Remove active class from all conversations
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
}

function displayMessages(messages) {
    const chatMessages = document.getElementById('chat-messages');
    chatMessages.innerHTML = '';
    
    messages.forEach(message => {
        addMessageToChat(message.text, message.sender, false);
    });
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessageToChat(text, sender, animate = true) {
    const chatMessages = document.getElementById('chat-messages');
    
    // Remove welcome container if it exists
    const welcomeContainer = chatMessages.querySelector('.welcome-container');
    if (welcomeContainer) {
        welcomeContainer.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    // Get user initial from template or use default
    const userInitial = document.querySelector('.user-avatar')?.textContent || 'U';
    avatar.textContent = sender === 'user' ? userInitial : '🤖';
    
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
    if (event) event.preventDefault();
    
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
    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: messageText,
            conversation_id: currentConversationId
        })
    })
    .then(response => response.json())
    .then(data => {
        // Add AI response to chat
        addMessageToChat(data.reply, 'ai');
        
        // Update current conversation ID if it was a new chat
        if (!currentConversationId && data.conversation_id) {
            currentConversationId = data.conversation_id;
            // Refresh conversations list
            location.reload();
        }
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

function logout() {
    if (confirm('¿Estás seguro de que quieres cerrar sesión?')) {
        window.location.href = '/logout';
    }
}

function editConversation(conversationId, currentTitle) {
    const newTitle = prompt('Nuevo nombre para la conversación:', currentTitle);
    
    if (newTitle === null || newTitle.trim() === '') {
        return; // Usuario canceló o no ingresó nada
    }
    
    if (newTitle.trim() === currentTitle) {
        return; // No hay cambios
    }
    
    fetch(`/conversation/${conversationId}/edit`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            title: newTitle.trim()
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Actualizar el título en la interfaz
            const conversationItem = document.querySelector(`[data-id="${conversationId}"]`);
            const titleElement = conversationItem.querySelector('.conversation-title');
            titleElement.textContent = data.title;
            
            // Si es la conversación activa, actualizar el título del chat
            if (currentConversationId === conversationId) {
                document.getElementById('chat-title').textContent = data.title;
            }
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al actualizar el nombre de la conversación');
    });
}

function deleteConversation(conversationId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta conversación? Esta acción no se puede deshacer.')) {
        return;
    }
    
    fetch(`/conversation/${conversationId}/delete`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Eliminar el elemento de la interfaz
            const conversationItem = document.querySelector(`[data-id="${conversationId}"]`);
            conversationItem.remove();
            
            // Si era la conversación activa, limpiar el chat
            if (currentConversationId === conversationId) {
                currentConversationId = null;
                document.getElementById('chat-title').textContent = 'Selecciona una conversación';
                document.getElementById('chat-messages').innerHTML = `
                    <div class="welcome-message">
                        <div class="message ai">
                            <div class="message-avatar">🤖</div>
                            <div class="message-content">
                                ¡Hola! Soy tu asistente virtual IA. ¿En qué puedo ayudarte?
                            </div>
                        </div>
                    </div>
                `;
                
                // Cargar la primera conversación disponible si existe
                const firstConversation = document.querySelector('.conversation-item');
                if (firstConversation) {
                    const firstConversationId = firstConversation.getAttribute('data-id');
                    loadConversation(parseInt(firstConversationId));
                }
            }
        } else {
            alert('Error: ' + data.error);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error al eliminar la conversación');
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

function loadConversation(conversationId) {
    currentConversationId = conversationId;
    
    // Update active conversation
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-id="${conversationId}"]`).classList.add('active');
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    
    // Load messages for this conversation
    fetch(`/conversation/${conversationId}/messages`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('chat-title').textContent = data.title;
            displayMessages(data.messages);
        })
        .catch(error => {
            console.error('Error loading conversation:', error);
        });
}

// Load first conversation on page load
document.addEventListener('DOMContentLoaded', function() {
    const firstConversation = document.querySelector('.conversation-item');
    if (firstConversation) {
        const conversationId = firstConversation.getAttribute('data-id');
        loadConversation(parseInt(conversationId));
    }
});
