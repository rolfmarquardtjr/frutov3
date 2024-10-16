document.addEventListener('DOMContentLoaded', function() {
    const ideaForm = document.getElementById('ideaForm');
    const ideaDescription = document.getElementById('ideaDescription');
    const questionsSection = document.getElementById('questionsSection');
    const questionsList = document.getElementById('questionsList');
    const submitAnswerBtn = document.getElementById('submitAnswer');
    const newIdeaBtn = document.getElementById('newIdeaBtn');
    const savedIdeasList = document.getElementById('savedIdeasList');

    let currentIdeaId = null;
    let currentQuestions = [];
    let currentQuestionIndex = 0;

    if (ideaForm) {
        ideaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const ideaText = ideaDescription.value;
            
            // Desativar o campo de texto e o botão de envio
            ideaDescription.disabled = true;
            const submitButton = ideaForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.style.backgroundColor = '#808080'; // Cor cinza
            submitButton.style.borderColor = '#808080'; // Borda cinza

            // Adicionar mensagem criativa com loader fora da caixa branca
            const creativeMessage = document.createElement('div');
            creativeMessage.innerHTML = `
                <div class="text-center mt-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <p class="mt-2 lead">Uau, que ideia inovadora! 🚀 Deixa eu pensar em algumas perguntas pra gente turbinar isso!</p>
                </div>
            `;
            ideaForm.closest('.card').insertAdjacentElement('afterend', creativeMessage);

            fetch('/save_idea', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ description: ideaText }),
            })
            .then(response => response.json())
            .then(data => {
                console.log('Ideia salva:', data);
                currentIdeaId = data.id;
                return fetch('/generate_questions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ idea_id: currentIdeaId }),
                });
            })
            .then(response => response.json())
            .then(questions => {
                console.log('Perguntas geradas:', questions);
                currentQuestions = questions;
                currentQuestionIndex = 0;
                // Remover a mensagem criativa
                creativeMessage.remove();
                displayNextQuestion();
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Ocorreu um erro ao processar sua ideia. Por favor, tente novamente.');
                // Reativar o campo de texto e o botão em caso de erro
                ideaDescription.disabled = false;
                const submitButton = ideaForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '#4CAF50'; // Cor verde
                submitButton.style.borderColor = '#4CAF50'; // Borda verde
                // Remover a mensagem criativa em caso de erro
                creativeMessage.remove();
            });
        });
    }

    function displayNextQuestion() {
        console.log('Exibindo próxima pergunta. Índice:', currentQuestionIndex);
        if (currentQuestionIndex < currentQuestions.length) {
            const question = currentQuestions[currentQuestionIndex];
            console.log('Pergunta atual:', question);
            questionsList.innerHTML = `
                <div class="mb-3">
                    <label for="question${currentQuestionIndex}" class="form-label">
                        ${question} (${currentQuestionIndex + 1} de ${currentQuestions.length})
                    </label>
                    <textarea class="form-control" id="question${currentQuestionIndex}" rows="3"></textarea>
                </div>
            `;
            questionsSection.style.display = 'block';
            questionsSection.classList.remove('d-none');
            submitAnswerBtn.style.display = 'block';
            submitAnswerBtn.classList.remove('d-none');
            submitAnswerBtn.textContent = currentQuestionIndex === currentQuestions.length - 1 ? 'Finalizar' : 'Próxima Pergunta';
        } else {
            console.log('Todas as perguntas foram respondidas');
            showFinalLoader();
        }
    }

    if (submitAnswerBtn) {
        submitAnswerBtn.addEventListener('click', function() {
            const answer = document.querySelector(`#question${currentQuestionIndex}`).value;
            currentQuestions[currentQuestionIndex] = {
                question: currentQuestions[currentQuestionIndex],
                answer: answer
            };
            currentQuestionIndex++;

            // Mudar a cor do botão para amarelo quando clicado
            this.style.setProperty('--bs-btn-bg', '#ffc107');
            this.style.setProperty('--bs-btn-border-color', '#ffc107');
            this.style.setProperty('--bs-btn-hover-bg', '#ffca2c');
            this.style.setProperty('--bs-btn-hover-border-color', '#ffc720');
            this.style.setProperty('--bs-btn-active-bg', '#ffcd39');
            this.style.setProperty('--bs-btn-active-border-color', '#ffc720');
            this.style.setProperty('--bs-btn-disabled-bg', '#ffc107');
            this.style.setProperty('--bs-btn-disabled-border-color', '#ffc107');

            displayNextQuestion();
        });
    }

    function showFinalLoader() {
        // Ocultar a seção de perguntas
        questionsSection.style.display = 'none';
        
        // Criar e exibir o loader final
        const finalLoader = document.createElement('div');
        finalLoader.innerHTML = `
            <div class="text-center mt-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Carregando...</span>
                </div>
                <p class="mt-2 lead">Estou analisando suas respostas e criando um projeto incrível para você! 🚀 Isso pode levar alguns segundinhos... ⏳</p>
            </div>
        `;
        questionsSection.parentNode.insertBefore(finalLoader, questionsSection.nextSibling);

        // Chamar a função para enviar as respostas
        submitAnswers();
    }

    function submitAnswers() {
        const answers = currentQuestions.map(q => q.answer);
        fetch('/save_answers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ idea_id: currentIdeaId, answers: answers }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                return fetch('/generate_tasks', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify({ idea_id: currentIdeaId }),
                });
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Criar e exibir o modal de sucesso
                const successModal = document.createElement('div');
                successModal.innerHTML = `
                    <div class="modal fade" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
                        <div class="modal-dialog modal-dialog-centered">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title" id="successModalLabel">Sucesso!</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    <p>Respostas enviadas e tarefas geradas com sucesso! Redirecionando para o quadro Kanban.</p>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(successModal);
                
                const modal = new bootstrap.Modal(document.getElementById('successModal'));
                modal.show();
                
                // Redirecionar após fechar o modal
                document.getElementById('successModal').addEventListener('hidden.bs.modal', function () {
                    window.location.href = `/kanban/${currentIdeaId}`;
                });
            }
        })
        .catch(error => {
            console.error('Erro:', error);
            alert('Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.');
        });
    }

    if (newIdeaBtn) {
        newIdeaBtn.addEventListener('click', function() {
            if (ideaForm) {
                ideaForm.reset();
                ideaDescription.disabled = false;
                const submitButton = ideaForm.querySelector('button[type="submit"]');
                submitButton.disabled = false;
                submitButton.style.backgroundColor = '#4CAF50'; // Cor verde
                submitButton.style.borderColor = '#4CAF50'; // Borda verde
            }
            if (questionsSection) questionsSection.classList.add('d-none');
            newIdeaBtn.classList.add('d-none');
            currentIdeaId = null;
        });
    }

    // Sidebar toggle
    const sidebarCollapse = document.getElementById('sidebarCollapse');
    const sidebar = document.getElementById('sidebar');
    if (sidebarCollapse && sidebar) {
        sidebarCollapse.addEventListener('click', function() {
            sidebar.classList.toggle('active');
        });
    }

    // Mantenha apenas este trecho para lidar com os botões de exclusão
    const deleteButtons = document.querySelectorAll('.delete-idea');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            const ideaId = this.getAttribute('data-idea-id');
            showDeleteConfirmationModal(ideaId, this);
        });
    });

    const selectButtons = document.querySelectorAll('.select-idea');

    selectButtons.forEach(button => {
        button.addEventListener('click', function() {
            const ideaId = this.getAttribute('data-idea-id');
            window.location.href = `/kanban/${ideaId}`;
        });
    });
});

function displayTasks(tasks) {
    const todoList = document.getElementById('todoList');
    const inProgressList = document.getElementById('inProgressList');
    const closedList = document.getElementById('closedList');

    if (todoList) todoList.innerHTML = '';
    if (inProgressList) inProgressList.innerHTML = '';
    if (closedList) closedList.innerHTML = '';

    tasks.forEach(task => {
        const taskElement = createTaskElement(task);
        switch (task.status) {
            case 'to_do':
                if (todoList) todoList.appendChild(taskElement);
                break;
            case 'in_progress':
                if (inProgressList) inProgressList.appendChild(taskElement);
                break;
            case 'closed':
                if (closedList) closedList.appendChild(taskElement);
                break;
        }
    });

    if (kanbanBoard) kanbanBoard.classList.remove('d-none');
    initKanban();
}

function createTaskElement(task) {
    const li = document.createElement('li');
    li.className = 'kanban-item';
    li.setAttribute('data-id', task.id);
    
    const criticalityClass = getCriticalityClass(task.criticality);
    const criticalityText = getCriticalityText(task.criticality);

    li.innerHTML = `
        <div class="kanban-item-header">
            <span class="kanban-item-title">${task.content}</span>
            <span class="kanban-item-criticality ${criticalityClass}">${criticalityText}</span>
        </div>
        <div class="kanban-item-tags">
            ${task.tags.map(tag => `<span class="kanban-item-tag">${tag.name}</span>`).join('')}
        </div>
        <div class="kanban-item-actions mt-2">
            <button class="btn btn-sm btn-outline-primary edit-task-btn">Editar</button>
            <button class="btn btn-sm btn-outline-danger delete-task-btn">Excluir</button>
        </div>
    `;

    li.querySelector('.edit-task-btn').addEventListener('click', () => editTask(task));
    li.querySelector('.delete-task-btn').addEventListener('click', () => deleteTask(task.id));

    return li;
}

function getCriticalityClass(criticality) {
    switch (parseInt(criticality)) {
        case 0: return 'criticality-low';
        case 1: return 'criticality-medium';
        case 2: return 'criticality-high';
        default: return '';
    }
}

function getCriticalityText(criticality) {
    switch (parseInt(criticality)) {
        case 0: return 'Baixa';
        case 1: return 'Média';
        case 2: return 'Alta';
        default: return 'N/A';
    }
}

$(document).ready(function () {
    $('#sidebarCollapse').on('click', function () {
        $('#sidebar, #content').toggleClass('active');
    });
});

function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

function showAlert(message, type) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.querySelector('.container').insertAdjacentElement('afterbegin', alertDiv);
    
    // Remover o alerta após 5 segundos
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function showDeleteConfirmationModal(ideaId, buttonElement) {
    // Remova qualquer modal existente
    const existingModal = document.getElementById('deleteConfirmationModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Crie o novo modal com estilo Bootstrap
    const modalHTML = `
    <div class="modal fade" id="deleteConfirmationModal" tabindex="-1" aria-labelledby="deleteConfirmationModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header border-0">
                    <h5 class="modal-title" id="deleteConfirmationModalLabel">Confirmar Exclusão</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    Tem certeza que deseja excluir esta ideia? Esta ação não pode ser desfeita.
                </div>
                <div class="modal-footer border-0">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Excluir</button>
                </div>
            </div>
        </div>
    </div>
    `;

    // Adicione o modal ao corpo do documento
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Configure o evento de clique no botão de confirmação
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        deleteIdea(ideaId, buttonElement);
        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteConfirmationModal'));
        modal.hide();
    });

    // Exiba o modal
    const modal = new bootstrap.Modal(document.getElementById('deleteConfirmationModal'));
    modal.show();
}

function deleteIdea(ideaId, buttonElement) {
    fetch(`/delete_idea/${ideaId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCsrfToken()
        },
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const listItem = buttonElement.closest('li');
            if (listItem) {
                listItem.remove();
            }
            showAlert('Ideia excluída com sucesso!', 'success');
        } else {
            throw new Error(data.error || 'Erro ao excluir a ideia');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Ocorreu um erro ao excluir a ideia. Por favor, tente novamente.', 'danger');
    });
}
