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
            ideaForm.querySelector('button[type="submit"]').disabled = true;

            // Adicionar mensagem criativa com loader
            const creativeMessage = document.createElement('div');
            creativeMessage.innerHTML = `
                <div class="text-center mt-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Carregando...</span>
                    </div>
                    <p class="mt-2 lead">Hmm, que ideia interessante! Deixe-me pensar em algumas perguntas para entendê-la melhor...</p>
                </div>
            `;
            ideaForm.parentNode.insertBefore(creativeMessage, ideaForm.nextSibling);

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
                ideaForm.querySelector('button[type="submit"]').disabled = false;
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
                <p class="mt-2 lead">Estou processando suas respostas e gerando tarefas para o seu projeto. Isso pode levar alguns segundos...</p>
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
                ideaForm.querySelector('button[type="submit"]').disabled = false;
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
