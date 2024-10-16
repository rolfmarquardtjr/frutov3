document.addEventListener('DOMContentLoaded', function() {
    const ideaId = window.location.pathname.split('/').pop();
    const goalModal = new bootstrap.Modal(document.getElementById('goalModal'));
    const saveGoalBtn = document.getElementById('saveGoalBtn');
    const addGoalBtn = document.getElementById('addGoalBtn');
    const generateGoalsBtn = document.getElementById('generateGoalsBtn');
    let overallProgressChart;

    const toggleFilterBtn = document.getElementById('toggleFilterBtn');
    const filterSection = document.getElementById('filterSection');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const titleFilter = document.getElementById('titleFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');

    // Verificar se os elementos existem antes de adicionar event listeners
    if (toggleFilterBtn) {
        toggleFilterBtn.addEventListener('click', function() {
            filterSection.style.display = filterSection.style.display === 'none' ? 'block' : 'none';
        });
    }

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', applyFilter);
    }

    function applyFilter() {
        const title = titleFilter.value.toLowerCase();
        const category = categoryFilter.value;
        const status = statusFilter.value;

        document.querySelectorAll('.goals-list .card').forEach(goalCard => {
            const goalTitle = goalCard.querySelector('.card-title').textContent.toLowerCase();
            const goalCategory = goalCard.closest('.col-md-12').querySelector('.category-header h5').textContent.toLowerCase();
            const goalStatus = goalCard.querySelector('small.text-muted:nth-of-type(2)').textContent.split(': ')[1];

            const titleMatch = goalTitle.includes(title);
            const categoryMatch = category === '' || goalCategory.includes(category);
            const statusMatch = status === '' || goalStatus === status;

            if (titleMatch && categoryMatch && statusMatch) {
                goalCard.style.display = '';
            } else {
                goalCard.style.display = 'none';
            }
        });
    }

    function loadGoals() {
        fetch(`/api/goals/${ideaId}`)
            .then(response => response.json())
            .then(goals => {
                const lists = {
                    especifica: document.querySelector('#especificaList .goals-list'),
                    mensuravel: document.querySelector('#mensuravelList .goals-list'),
                    alcancavel: document.querySelector('#alcancavelList .goals-list'),
                    relevante: document.querySelector('#relevanteList .goals-list'),
                    temporal: document.querySelector('#temporalList .goals-list')
                };

                Object.entries(lists).forEach(([category, list]) => {
                    if (list) {
                        list.innerHTML = '';
                    } else {
                        console.error(`Element for category ${category} not found`);
                    }
                });

                const categoryProgress = {
                    especifica: [],
                    mensuravel: [],
                    alcancavel: [],
                    relevante: [],
                    temporal: []
                };

                goals.forEach(goal => {
                    const goalElement = createGoalElement(goal);
                    const list = lists[goal.category];
                    if (list) {
                        list.appendChild(goalElement);
                    } else {
                        console.error(`List for category ${goal.category} not found`);
                    }
                    categoryProgress[goal.category].push(goal.progress || 0);
                });

                updateCategoryProgress(categoryProgress);
                updateOverallProgress(categoryProgress);

                // Aplicar filtro inicial após carregar as metas
                if (typeof applyFilter === 'function') {
                    applyFilter();
                }
            })
            .catch(error => console.error('Error loading goals:', error));
    }

    function createGoalElement(goal) {
        const div = document.createElement('div');
        div.className = 'card mb-2';
        div.innerHTML = `
            <div class="card-body">
                <h5 class="card-title">${goal.title}</h5>
                <p class="card-text">${goal.description}</p>
                <p class="card-text"><small class="text-muted">Prazo: ${goal.deadline ? new Date(goal.deadline).toLocaleDateString() : 'Não definido'}</small></p>
                <p class="card-text"><small class="text-muted">Status: ${goal.status}</small></p>
                <div class="goal-progress-container">
                    <div class="goal-progress" data-goal-id="${goal.id}"></div>
                    <div class="goal-progress-value">${goal.progress || 0}%</div>
                </div>
                <button class="btn btn-sm btn-primary edit-goal mt-2" data-goal-id="${goal.id}">Editar</button>
                <button class="btn btn-sm btn-danger delete-goal mt-2" data-goal-id="${goal.id}">Excluir</button>
            </div>
        `;

        div.querySelector('.edit-goal').addEventListener('click', () => editGoal(goal));
        div.querySelector('.delete-goal').addEventListener('click', () => deleteGoal(goal.id));

        const slider = div.querySelector('.goal-progress');
        const valueDisplay = div.querySelector('.goal-progress-value');

        noUiSlider.create(slider, {
            start: [goal.progress || 0],
            connect: [true, false],
            step: 1,
            range: {
                'min': 0,
                'max': 100
            }
        });

        slider.noUiSlider.on('update', function (values, handle) {
            const value = Math.round(values[handle]);
            valueDisplay.textContent = value + '%';
        });

        slider.noUiSlider.on('change', function (values, handle) {
            const value = Math.round(values[handle]);
            updateGoalProgress(goal.id, value);
        });

        return div;
    }

    function updateGoalProgress(goalId, progress) {
        fetch(`/api/goals/${goalId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ progress: parseInt(progress) })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadGoals();
            }
        })
        .catch(error => console.error('Error:', error));
    }

    function updateCategoryProgress(categoryProgress) {
        Object.entries(categoryProgress).forEach(([category, progresses]) => {
            const average = progresses.length > 0 ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0;
            const progressElement = document.getElementById(`${category}Progress`);
            if (progressElement) {
                progressElement.textContent = `${average.toFixed(1)}%`;
            }
        });
    }

    function updateOverallProgress(categoryProgress) {
        const ctx = document.getElementById('overallProgressChart').getContext('2d');
        const categories = Object.keys(categoryProgress);
        const averages = categories.map(category => {
            const progresses = categoryProgress[category];
            return progresses.length > 0 ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0;
        });

        if (overallProgressChart) {
            overallProgressChart.destroy();
        }

        overallProgressChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: categories.map(category => category.charAt(0).toUpperCase() + category.slice(1)),
                datasets: [{
                    label: 'Progresso das Metas',
                    data: averages,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)',
                        'rgba(153, 102, 255, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.parsed.y.toFixed(1) + '%';
                            }
                        }
                    }
                }
            }
        });

        // Ajustar o tamanho do gráfico
        ctx.canvas.parentNode.style.height = '300px';  // Aumentar a altura para 300px
        ctx.canvas.parentNode.style.width = '100%';    // Usar 100% da largura disponível
    }

    function addGoal(goal) {
        fetch(`/api/goals/${ideaId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(goal)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload(); // Recarrega a página após a adição bem-sucedida
            } else {
                throw new Error(data.error || 'Erro ao adicionar meta');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao adicionar a meta. Por favor, tente novamente.');
        });
    }

    function updateGoal(goal) {
        fetch(`/api/goals/${goal.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(goal)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                location.reload(); // Recarrega a página após a atualização bem-sucedida
            } else {
                throw new Error(data.error || 'Erro ao atualizar meta');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao atualizar a meta. Por favor, tente novamente.');
        });
    }

    function deleteGoal(goalId) {
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
                            <p>Tem certeza que deseja excluir esta meta?</p>
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
            fetch(`/api/goals/${goalId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                }
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro na resposta do servidor');
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    location.reload(); // Recarrega a página após a exclusão bem-sucedida
                } else {
                    throw new Error(data.error || 'Falha ao excluir a meta');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao excluir a meta. Por favor, tente novamente.');
            });
        });
    }

    function editGoal(goal) {
        document.getElementById('goalId').value = goal.id;
        document.getElementById('goalTitle').value = goal.title;
        document.getElementById('goalDescription').value = goal.description;
        document.getElementById('goalDeadline').value = goal.deadline ? goal.deadline.split('T')[0] : '';
        document.getElementById('goalStatus').value = goal.status;
        document.getElementById('goalCategory').value = goal.category;
        document.getElementById('goalProgress').value = goal.progress || 0;
        document.getElementById('goalProgressValue').textContent = `${goal.progress || 0}%`;
        goalModal.show();
    }

    addGoalBtn.addEventListener('click', () => {
        document.getElementById('goalForm').reset();
        document.getElementById('goalId').value = '';
        goalModal.show();
    });

    saveGoalBtn.addEventListener('click', () => {
        const goal = {
            id: document.getElementById('goalId').value,
            title: document.getElementById('goalTitle').value,
            description: document.getElementById('goalDescription').value,
            deadline: document.getElementById('goalDeadline').value,
            status: document.getElementById('goalStatus').value,
            category: document.getElementById('goalCategory').value,
            progress: parseInt(document.getElementById('goalProgress').value)
        };

        if (goal.id) {
            updateGoal(goal);
        } else {
            addGoal(goal);
        }
    });

    // Add event listener for progress slider in modal
    document.getElementById('goalProgress').addEventListener('input', function() {
        document.getElementById('goalProgressValue').textContent = `${this.value}%`;
    });

    generateGoalsBtn.addEventListener('click', () => {
        // Criar e exibir o modal de configuração
        const configModal = document.createElement('div');
        configModal.innerHTML = `
            <div class="modal fade" id="goalConfigModal" tabindex="-1" aria-labelledby="goalConfigModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="goalConfigModalLabel">Configurar Geração de Metas</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p class="text-muted">Ei, empreendedor de sucesso! Vamos turbinar suas metas? Preencha os campos abaixo com carinho e deixe a mágica acontecer! 🚀✨</p>
                            <div class="mb-3">
                                <label for="goalTimeframe" class="form-label">Período das Metas</label>
                                <select class="form-select" id="goalTimeframe">
                                    <option value="trimestral">Trimestral</option>
                                    <option value="semestral">Semestral</option>
                                    <option value="anual">Anual</option>
                                    <option value="2anos">2 Anos</option>
                                    <option value="moonshot">Moonshot</option>
                                </select>
                                <small class="form-text text-muted">Dica: Escolha um período que te desafie, mas não te assuste!</small>
                            </div>
                            <div class="mb-3">
                                <label for="goalAggression" class="form-label">Agressividade das Metas</label>
                                <input type="range" class="form-range" id="goalAggression" min="1" max="5" step="1">
                                <div class="d-flex justify-content-between">
                                    <span>Conservador</span>
                                    <span>Moderado</span>
                                    <span>Agressivo</span>
                                </div>
                                <small class="form-text text-muted">Dica: Seja audacioso, mas realista. Encontre o equilíbrio perfeito!</small>
                            </div>
                            <div class="mb-3">
                                <label for="goalBudget" class="form-label">Orçamento para o Período</label>
                                <input type="number" class="form-control" id="goalBudget" placeholder="Digite o valor em reais">
                                <small class="form-text text-muted">Dica: Um bom orçamento é como um mapa do tesouro para suas metas!</small>
                            </div>
                            <div class="mb-3">
                                <label for="goalContext" class="form-label">Informações Adicionais</label>
                                <textarea class="form-control" id="goalContext" rows="3" placeholder="Compartilhe detalhes sobre seu negócio, desafios atuais ou objetivos específicos"></textarea>
                                <small class="form-text text-muted">Dica: Quanto mais detalhes você fornecer, mais personalizadas serão suas metas. Não tenha medo de sonhar alto!</small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-primary" id="generateGoalsConfirm">Gerar Metas</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(configModal);
        
        const modal = new bootstrap.Modal(document.getElementById('goalConfigModal'));
        modal.show();
        
        document.getElementById('generateGoalsConfirm').addEventListener('click', function() {
            const timeframe = document.getElementById('goalTimeframe').value;
            const aggression = document.getElementById('goalAggression').value;
            const budget = document.getElementById('goalBudget').value;
            const context = document.getElementById('goalContext').value;
            
            generateGoals(timeframe, aggression, budget, context);
            modal.hide();
        });
    });

    function generateGoals(timeframe, aggression, budget, context) {
        // Desabilita o botão e mostra o spinner
        generateGoalsBtn.disabled = true;
        generateGoalsBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';

        // Remover campos vazios ou undefined
        const data = {
            timeframe,
            aggression,
            ...(budget && { budget }),
            ...(context && { context })
        };

        fetch(`/api/goals/${ideaId}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                loadGoals();
            } else {
                alert('Erro ao gerar metas: ' + (data.error || 'Erro desconhecido'));
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Erro ao gerar metas. Por favor, tente novamente.');
        })
        .finally(() => {
            // Reabilita o botão e restaura o texto original
            generateGoalsBtn.disabled = false;
            generateGoalsBtn.innerHTML = '<i class="fas fa-robot"></i> Gerar Metas com IA';
        });
    }

    function showSuccessModal(message) {
        const successModal = document.createElement('div');
        successModal.innerHTML = `
            <div class="modal" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="successModalLabel">Sucesso!</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>${message}</p>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(successModal);
        
        const modal = new bootstrap.Modal(document.getElementById('successModal'), {
            backdrop: false // Isso remove o backdrop
        });
        modal.show();
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    // Add event listeners for category headers
    document.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', function() {
            const icon = this.querySelector('.category-icon');
            icon.classList.toggle('collapsed');
        });
    });

    // Chamar loadGoals() no final do script
    loadGoals();
});