document.addEventListener('DOMContentLoaded', function() {
    const ideaForm = document.getElementById('ideaForm');
    const questionsSection = document.getElementById('questionsSection');
    const questionsList = document.getElementById('questionsList');
    const submitAnswerBtn = document.getElementById('submitAnswer');
    const newIdeaBtn = document.getElementById('newIdeaBtn');
    const savedIdeasList = document.getElementById('savedIdeasList');
    const kanbanBoard = document.getElementById('kanbanBoard');

    let currentIdeaId = null;
    let currentQuestions = [];
    let currentQuestionIndex = 0;

    if (ideaForm) {
        ideaForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const ideaDescription = document.getElementById('ideaDescription').value;
            
            fetch('/save_idea', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ description: ideaDescription }),
            })
            .then(response => response.json())
            .then(data => {
                currentIdeaId = data.id;
                return fetch('/generate_questions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ idea_id: currentIdeaId }),
                });
            })
            .then(response => response.json())
            .then(questions => {
                currentQuestions = questions;
                currentQuestionIndex = 0;
                displayNextQuestion();
            })
            .catch(error => {
                console.error('Erro:', error);
                alert('Ocorreu um erro ao processar sua ideia. Por favor, tente novamente.');
            });
        });
    }

    function displayNextQuestion() {
        if (currentQuestionIndex < currentQuestions.length) {
            const question = currentQuestions[currentQuestionIndex];
            questionsList.innerHTML = `
                <div class="mb-3">
                    <label for="question${currentQuestionIndex}" class="form-label">${question}</label>
                    <textarea class="form-control" id="question${currentQuestionIndex}" rows="3"></textarea>
                </div>
            `;
            questionsSection.classList.remove('d-none');
            submitAnswerBtn.classList.remove('d-none');
        } else {
            // Todas as perguntas foram respondidas
            submitAnswers();
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

    function submitAnswers() {
        const answers = currentQuestions.map(q => q.answer);
        fetch('/save_answers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
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
                    },
                    body: JSON.stringify({ idea_id: currentIdeaId }),
                });
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                displayTasks(data.tasks);
                alert('Respostas enviadas e tarefas geradas com sucesso!');
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
                ideaForm.querySelectorAll('textarea').forEach(el => el.disabled = false);
            }
            if (questionsSection) questionsSection.classList.add('d-none');
            newIdeaBtn.classList.add('d-none');
            currentIdeaId = null;
        });
    }

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
        li.className = 'list-group-item';
        li.setAttribute('data-id', task.id);
        li.textContent = task.content;
        return li;
    }

    function initKanban() {
        const lists = document.querySelectorAll('.kanban-list');
        lists.forEach(list => {
            new Sortable(list, {
                group: 'shared',
                animation: 150,
                onEnd: function(evt) {
                    const taskId = evt.item.getAttribute('data-id');
                    const newStatus = evt.to.getAttribute('data-status');
                    updateTaskStatus(taskId, newStatus);
                }
            });
        });
    }

    function updateTaskStatus(taskId, newStatus) {
        fetch('/update_task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ task_id: taskId, status: newStatus }),
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                console.error('Failed to update task status');
            }
        })
        .catch(error => {
            console.error('Error:', error);
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

    // Kanban functionality
    if (kanbanBoard) {
        initKanban();
    }
});