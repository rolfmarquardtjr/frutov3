document.addEventListener('DOMContentLoaded', function() {
    const marketResearchForm = document.getElementById('marketResearchForm');
    const generateResearchBtn = document.getElementById('generateResearchBtn');
    const researchResults = document.getElementById('researchResults');
    const researchContent = document.getElementById('researchContent');
    const researchModal = new bootstrap.Modal(document.getElementById('researchModal'));
    const researchModalContent = document.getElementById('researchModalContent');
    const deleteResearchModal = new bootstrap.Modal(document.getElementById('deleteResearchModal'));

    marketResearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        generateResearch();
    });

    document.querySelectorAll('.view-research').forEach(button => {
        button.addEventListener('click', function() {
            const researchId = this.getAttribute('data-research-id');
            viewFullResearch(researchId);
        });
    });

    const deleteResearchModalContent = document.getElementById('deleteResearchModalContent');
    let currentResearchId = null;

    document.querySelectorAll('.delete-research').forEach(button => {
        button.addEventListener('click', function() {
            currentResearchId = this.getAttribute('data-research-id');
            deleteResearchModal.show();
        });
    });

    document.getElementById('confirmDeleteResearch').addEventListener('click', function() {
        if (currentResearchId) {
            deleteResearch(currentResearchId);
            deleteResearchModal.hide();
        }
    });

    function generateResearch() {
        const location = document.getElementById('location').value;
        const options = Array.from(document.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);

        generateResearchBtn.disabled = true;
        generateResearchBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

        fetch(`/api/market_research/${getIdeaId()}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ location: location, options: options })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                researchContent.innerHTML = formatResearchContent(data.content);
                researchResults.style.display = 'block';
            } else {
                throw new Error(data.error || 'Erro desconhecido ao gerar pesquisa de mercado');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao gerar a pesquisa de mercado: ' + error.message);
        })
        .finally(() => {
            generateResearchBtn.disabled = false;
            generateResearchBtn.innerHTML = 'Gerar Pesquisa';
        });
    }

    function viewFullResearch(researchId) {
        fetch(`/api/market_research/${researchId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                researchModalContent.innerHTML = `
                    <h6>Localização: ${data.location || 'Não especificada'}</h6>
                    <h6>Data: ${new Date(data.created_at).toLocaleString()}</h6>
                    <hr>
                    ${formatResearchContent(data.content)}
                `;
                researchModal.show();
            } else {
                throw new Error(data.error || 'Erro desconhecido ao carregar pesquisa');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao carregar a pesquisa: ' + error.message);
        });
    }

    function formatResearchContent(content) {
        // Substituir "###" por bullet points, tornar links clicáveis e adicionar quebras de linha
        return content
            .replace(/###/g, '•')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>')
            .replace(/\n/g, '<br>')
            .replace(/(\d+\.)/g, '<br><strong>$1</strong>')
            .replace(/(\w+:)/g, '<br><strong>$1</strong>');
    }

    function getIdeaId() {
        return window.location.pathname.split('/').pop();
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    function deleteResearch(researchId) {
        fetch(`/api/market_research/${researchId}`, {
            method: 'DELETE',
            headers: {
                'X-CSRFToken': getCsrfToken()
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const researchCard = document.querySelector(`.delete-research[data-research-id="${researchId}"]`).closest('.card');
                researchCard.remove();
                showAlert('Pesquisa de mercado excluída com sucesso.', 'success');
            } else {
                throw new Error(data.error || 'Erro desconhecido ao excluir pesquisa');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showAlert('Ocorreu um erro ao excluir a pesquisa de mercado: ' + error.message, 'danger');
        });
    }

    function showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.role = 'alert';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;
        document.querySelector('.container').insertAdjacentElement('afterbegin', alertDiv);
    }
});
