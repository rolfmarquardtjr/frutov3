document.addEventListener('DOMContentLoaded', function() {
    const chatForm = document.getElementById('chat-form');
    const userInput = document.getElementById('user-input');
    const chatContainer = document.getElementById('chat-container');

    chatForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const message = userInput.value.trim();
        if (message) {
            sendMessage(message);
            userInput.value = '';
        }
    });

    function sendMessage(message) {
        appendMessage('user', message);

        fetch(`/api/assistant/${ideaId}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ message: message }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appendMessage('assistant', data.response);
            } else {
                appendMessage('assistant', 'Desculpe, ocorreu um erro. Por favor, tente novamente.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            appendMessage('assistant', 'Desculpe, ocorreu um erro. Por favor, tente novamente.');
        });
    }

    function appendMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}-message`;
        messageDiv.innerHTML = `<strong>${role.charAt(0).toUpperCase() + role.slice(1)}:</strong> ${content}`;
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
});

// Certifique-se de que a variável ideaId está definida globalmente ou passe-a como um parâmetro para a função sendMessage
const ideaId = document.querySelector('meta[name="idea-id"]').getAttribute('content');
