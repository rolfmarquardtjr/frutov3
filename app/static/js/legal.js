document.addEventListener('DOMContentLoaded', function() {
    const ideaId = window.location.pathname.split('/').pop();
    const generateLegalStepsBtn = document.getElementById('generateLegalStepsBtn');
    const legalStepsList = document.getElementById('legalStepsList');
    const consultationForm = document.getElementById('consultationForm');
    const consultationInput = document.getElementById('consultationInput');
    const consultationChat = document.getElementById('consultationChat');
    const remainingMessages = document.getElementById('remainingMessages');

    const checkInModalElement = document.getElementById('checkInModal');
    const checkInModal = checkInModalElement ? new bootstrap.Modal(checkInModalElement) : null;

    const progressSlider = document.getElementById('progressSlider');
    const currentProgress = document.getElementById('currentProgress');
    const saveProgressBtn = document.getElementById('saveProgress');

    const legalStepsSuccessModalElement = document.getElementById('legalStepsSuccessModal');
    const legalStepsSuccessModal = legalStepsSuccessModalElement ? new bootstrap.Modal(legalStepsSuccessModalElement) : null;

    let currentStepId = null;

    function updateProgressCircle(element, progress) {
        const fill = element.querySelector('.progress-circle-fill');
        const value = element.querySelector('.progress-circle-value');
        const degrees = progress * 3.6;
        
        fill.style.transform = `rotate(${Math.min(180, degrees)}deg)`;
        if (degrees > 180) {
            fill.style.transform = 'rotate(180deg)';
            fill.style.backgroundColor = '#b8860b';
            element.appendChild(fill.cloneNode(true)).style.transform = `rotate(${degrees}deg)`;
        }
        
        value.textContent = `${progress}%`;

        // Atualizar a cor do botão de check-in
        const checkInButton = element.closest('.card-body').querySelector('.check-in-step');
        if (progress === 100) {
            checkInButton.classList.remove('btn-check-in');
            checkInButton.classList.add('btn-success');
            checkInButton.textContent = 'Concluída';
            checkInButton.disabled = true;
        } else {
            checkInButton.classList.remove('btn-success');
            checkInButton.classList.add('btn-check-in');
            checkInButton.textContent = 'Check-in';
            checkInButton.disabled = false;
        }
    }

    legalStepsList.addEventListener('click', function(e) {
        if (e.target.classList.contains('check-in-step')) {
            currentStepId = e.target.dataset.stepId;
            const currentProgressValue = parseInt(e.target.closest('.card-body').querySelector('.progress-circle-value').textContent);
            progressSlider.value = currentProgressValue;
            currentProgress.textContent = currentProgressValue;
            checkInModal.show();
        } else if (e.target.classList.contains('detail-step')) {
            const stepId = e.target.dataset.stepId;
            const detailsContainer = document.getElementById(`stepDetails${stepId}`);
            
            if (detailsContainer.style.display === 'none') {
                getStepDetails(stepId, detailsContainer);
            } else {
                detailsContainer.style.display = 'none';
            }
        }
    });

    progressSlider.addEventListener('input', function() {
        currentProgress.textContent = this.value;
    });

    saveProgressBtn.addEventListener('click', function() {
        const newProgress = parseInt(progressSlider.value);
        updateStepProgress(currentStepId, newProgress);
        checkInModal.hide();
    });

    generateLegalStepsBtn.addEventListener('click', function() {
        this.disabled = true;
        this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

        fetch(`/api/legal/${ideaId}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (legalStepsSuccessModal) {
                    document.getElementById('legalStepsSuccessMessage').textContent = data.message;
                    legalStepsSuccessModal.show();
                    setTimeout(() => {
                        location.reload();
                    }, 3000);
                } else {
                    alert(data.message);
                    location.reload();
                }
            } else {
                alert('Erro ao gerar etapas legais: ' + (data.error || 'Erro desconhecido'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao gerar etapas legais. Por favor, tente novamente.');
        })
        .finally(() => {
            this.disabled = false;
            this.innerHTML = '<i class="fas fa-gavel"></i> Gerar Etapas Legais';
        });
    });

    consultationForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const message = consultationInput.value.trim();
        if (message) {
            sendConsultation(message);
            consultationInput.value = '';
        }
    });

    function sendConsultation(message) {
        fetch(`/api/legal/${ideaId}/consult`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ message: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                appendMessage('Você', message);
                appendMessage('Consultor', data.response);
                updateRemainingMessages();
            } else {
                alert('Erro na consulta: ' + (data.error || 'Erro desconhecido'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao enviar consulta. Por favor, tente novamente.');
        });
    }

    function appendMessage(sender, message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender === 'Você' ? 'user-message' : 'assistant-message'}`;
        messageDiv.innerHTML = `<strong>${sender}:</strong><p>${message}</p>`;
        consultationChat.appendChild(messageDiv);
        consultationChat.scrollTop = consultationChat.scrollHeight;
    }

    function updateRemainingMessages() {
        const remaining = parseInt(remainingMessages.textContent) - 1;
        remainingMessages.textContent = remaining;
        if (remaining <= 0) {
            consultationInput.disabled = true;
            consultationForm.querySelector('button').disabled = true;
        }
    }

    function updateStepProgress(stepId, progress) {
        fetch(`/api/legal/${ideaId}/update_progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ step_id: stepId, progress: progress })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const progressCircle = document.querySelector(`.progress-circle[data-step-id="${stepId}"]`);
                if (progressCircle) {
                    updateProgressCircle(progressCircle, progress);
                }
            } else {
                console.error('Failed to update step progress');
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    function getStepDetails(stepId, container) {
        container.innerHTML = '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Carregando...</span></div>';
        container.style.display = 'block';

        fetch(`/api/legal/${ideaId}/step_details/${stepId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                container.innerHTML = `<p>${data.details}</p>`;
            } else {
                container.innerHTML = `<p class="text-danger">Erro ao carregar detalhes: ${data.error}</p>`;
            }
        })
        .catch(error => {
            console.error('Error:', error);
            container.innerHTML = '<p class="text-danger">Erro ao carregar detalhes. Por favor, tente novamente.</p>';
        });
    }

    // Inicializar os círculos de progresso e cores dos botões
    document.querySelectorAll('.progress-circle').forEach(circle => {
        const progress = parseInt(circle.querySelector('.progress-circle-value').textContent);
        updateProgressCircle(circle, progress);
    });

    // Garantir que os botões tenham as cores corretas
    document.querySelectorAll('.btn-check-in').forEach(button => {
        button.style.backgroundColor = '#ffc107';
        button.style.borderColor = '#ffc107';
        button.style.color = '#000';
    });

    document.querySelectorAll('.btn-detail').forEach(button => {
        button.style.backgroundColor = '#000';
        button.style.borderColor = '#000';
        button.style.color = 'white';
    });
});
