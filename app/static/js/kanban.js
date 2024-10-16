document.addEventListener('DOMContentLoaded', function() {
    const kanbanBoard = document.getElementById('kanbanBoard');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const taskModalElement = document.getElementById('taskModal');
    const taskModal = new bootstrap.Modal(taskModalElement);
    const saveTaskBtn = document.getElementById('saveTaskBtn');

    const taskFilter = document.getElementById('taskFilter');
    const filterType = document.getElementById('filterType');
    const clearFilterBtn = document.getElementById('clearFilterBtn');

    if (taskFilter && filterType) {
        taskFilter.addEventListener('input', filterTasks);
        filterType.addEventListener('change', filterTasks);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilter);
    }

    function loadTasks() {
        const ideaId = kanbanBoard.getAttribute('data-idea-id');
        fetch(`/get_tasks/${ideaId}`)
            .then(response => response.json())
            .then(tasks => {
                displayTasks(tasks);
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao carregar as tarefas. Por favor, recarregue a página.');
            });
    }

    function displayTasks(tasks) {
        const todoList = document.getElementById('todoList');
        const inProgressList = document.getElementById('inProgressList');
        const closedList = document.getElementById('closedList');

        todoList.innerHTML = '';
        inProgressList.innerHTML = '';
        closedList.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            switch (task.status) {
                case 'to_do':
                    todoList.appendChild(taskElement);
                    break;
                case 'in_progress':
                    inProgressList.appendChild(taskElement);
                    break;
                case 'closed':
                    closedList.appendChild(taskElement);
                    break;
            }
        });

        initKanban();
    }

    function createTaskElement(task) {
        const li = document.createElement('li');
        li.className = 'kanban-item';
        li.setAttribute('data-id', task.id);
        li.setAttribute('data-due-date', task.due_date || '');
        
        const criticalityClass = getCriticalityClass(task.criticality);
        const criticalityText = getCriticalityText(task.criticality);

        li.innerHTML = `
            <div class="kanban-item-header">
                <span class="kanban-item-title">${task.content}</span>
                <span class="kanban-item-due-date">${task.due_date ? new Date(task.due_date).toLocaleDateString() : 'Sem data'}</span>
            </div>
            <div class="kanban-item-tags">
                ${task.tags.map(tag => `<span class="kanban-item-tag">${tag.name}</span>`).join('')}
            </div>
            <span class="kanban-item-criticality ${criticalityClass}">${criticalityText}</span>
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

    function initKanban() {
        const lists = document.querySelectorAll('.kanban-list');
        lists.forEach(list => {
            new Sortable(list, {
                group: 'shared',
                animation: 150,
                onEnd: function(evt) {
                    const taskId = evt.item.getAttribute('data-id');
                    const newStatus = evt.to.getAttribute('data-status');
                    const dueDate = evt.item.getAttribute('data-due-date');
                    updateTaskStatus(taskId, newStatus, dueDate);
                }
            });
        });
    }

    function updateTaskStatus(taskId, newStatus, dueDate) {
        const taskElement = document.querySelector(`.kanban-item[data-id="${taskId}"]`);
        const currentTags = Array.from(taskElement.querySelectorAll('.kanban-item-tag')).map(tag => tag.textContent);
        
        fetch('/update_task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ 
                task_id: taskId, 
                status: newStatus, 
                due_date: dueDate,
                tags: currentTags
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Atualizar o elemento da tarefa sem recarregar todas as tarefas
                const targetList = document.getElementById(`${newStatus}List`);
                targetList.appendChild(taskElement);
                updateTaskElement(data.task);
            } else {
                console.error('Falha ao atualizar o status da tarefa');
            }
        })
        .catch(error => {
            console.error('Erro:', error);
        });
    }

    function updateTaskElement(updatedTask) {
        const taskElement = document.querySelector(`.kanban-item[data-id="${updatedTask.id}"]`);
        if (taskElement) {
            const criticalityClass = getCriticalityClass(updatedTask.criticality);
            const criticalityText = getCriticalityText(updatedTask.criticality);

            // Preservar as tags existentes se não forem fornecidas na atualização
            const tags = updatedTask.tags && updatedTask.tags.length > 0 
                ? updatedTask.tags 
                : Array.from(taskElement.querySelectorAll('.kanban-item-tag')).map(tag => ({ name: tag.textContent }));

            taskElement.innerHTML = `
                <div class="kanban-item-header">
                    <span class="kanban-item-title">${updatedTask.content}</span>
                    <span class="kanban-item-due-date">${updatedTask.due_date ? new Date(updatedTask.due_date).toLocaleDateString() : 'Sem data'}</span>
                </div>
                <div class="kanban-item-tags">
                    ${tags.map(tag => `<span class="kanban-item-tag">${tag.name}</span>`).join('')}
                </div>
                <span class="kanban-item-criticality ${criticalityClass}">${criticalityText}</span>
                <div class="kanban-item-actions mt-2">
                    <button class="btn btn-sm btn-outline-primary edit-task-btn">Editar</button>
                    <button class="btn btn-sm btn-outline-danger delete-task-btn">Excluir</button>
                </div>
            `;

            taskElement.querySelector('.edit-task-btn').addEventListener('click', () => editTask(updatedTask));
            taskElement.querySelector('.delete-task-btn').addEventListener('click', () => deleteTask(updatedTask.id));

            taskElement.setAttribute('data-due-date', updatedTask.due_date || '');
        }
    }

    function editTask(task) {
        document.getElementById('taskContent').value = task.content;
        document.getElementById('taskStatus').value = task.status;
        document.getElementById('taskDueDate').value = task.due_date ? task.due_date.split('T')[0] : '';
        document.getElementById('taskCriticality').value = task.criticality;
        document.getElementById('taskTags').value = task.tags.map(tag => tag.name).join(', ');
        
        saveTaskBtn.onclick = function() {
            const updatedTask = {
                task_id: task.id,
                content: document.getElementById('taskContent').value,
                status: document.getElementById('taskStatus').value,
                due_date: document.getElementById('taskDueDate').value,
                criticality: parseInt(document.getElementById('taskCriticality').value),
                tags: document.getElementById('taskTags').value.split(',').map(tag => tag.trim())
            };

            fetch('/update_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify(updatedTask),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    taskModal.hide();
                    updateTaskElement(data);
                } else {
                    console.error('Failed to update task');
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        };

        taskModal.show();
    }

    function deleteTask(taskId) {
        // Criar e exibir o modal de confirmação
        const confirmModal = document.createElement('div');
        confirmModal.innerHTML = `
            <div class="modal fade" id="confirmDeleteModal" tabindex="-1" aria-labelledby="confirmDeleteModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmDeleteModalLabel">Confirmar Exclusão</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Tem certeza que deseja excluir esta tarefa?</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirmDeleteBtn">Excluir</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();
        
        document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
            modal.hide();
            fetch('/delete_task', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ task_id: taskId }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    loadTasks();
                } else {
                    console.error('Failed to delete task');
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        });
    }

    if (addTaskBtn) {
        addTaskBtn.addEventListener('click', () => {
            document.getElementById('taskForm').reset();
            saveTaskBtn.onclick = function() {
                const newTask = {
                    content: document.getElementById('taskContent').value,
                    status: document.getElementById('taskStatus').value,
                    due_date: document.getElementById('taskDueDate').value,
                    criticality: parseInt(document.getElementById('taskCriticality').value),
                    tags: document.getElementById('taskTags').value.split(',').map(tag => tag.trim()),
                    idea_id: kanbanBoard.getAttribute('data-idea-id')
                };

                fetch('/add_task', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCsrfToken()
                    },
                    body: JSON.stringify(newTask),
                })
                .then(response => response.json())
                .then(task => {
                    taskModal.hide();
                    loadTasks();
                })
                .catch(error => {
                    console.error('Error:', error);
                    alert('Ocorreu um erro ao adicionar a tarefa. Por favor, tente novamente.');
                });
            };

            taskModal.show();
        });
    }

    if (kanbanBoard) {
        loadTasks();
    }

    // Adicione este trecho para estilizar o novo botão
    const howToUseBtn = document.querySelector('button[data-bs-target="#howToUseModal"]');
    if (howToUseBtn) {
        howToUseBtn.classList.add('btn-outline-info');
        howToUseBtn.innerHTML = '<i class="fas fa-question-circle"></i> Como funciona';
    }
});

function filterTasks() {
    const filterValue = taskFilter.value.toLowerCase();
    const filterTypeValue = filterType.value;
    const tasks = document.querySelectorAll('.kanban-item');

    tasks.forEach(task => {
        let shouldShow = false;
        const taskContent = task.querySelector('.kanban-item-title').textContent.toLowerCase();
        const taskDate = task.querySelector('.kanban-item-due-date').textContent.toLowerCase();
        const taskCriticality = task.querySelector('.kanban-item-criticality').textContent.toLowerCase();
        const taskTags = Array.from(task.querySelectorAll('.kanban-item-tag')).map(tag => tag.textContent.toLowerCase());

        switch (filterTypeValue) {
            case 'date':
                shouldShow = taskDate.includes(filterValue);
                break;
            case 'criticality':
                shouldShow = taskCriticality.includes(filterValue);
                break;
            case 'tag':
                shouldShow = taskTags.some(tag => tag.includes(filterValue));
                break;
            default: // 'content'
                shouldShow = taskContent.includes(filterValue) || 
                             taskDate.includes(filterValue) || 
                             taskCriticality.includes(filterValue) || 
                             taskTags.some(tag => tag.includes(filterValue));
        }

        task.style.display = shouldShow ? '' : 'none';
    });
}

function clearFilter() {
    taskFilter.value = '';
    filterType.selectedIndex = 0;
    const tasks = document.querySelectorAll('.kanban-item');
    tasks.forEach(task => {
        task.style.display = '';
    });
}
