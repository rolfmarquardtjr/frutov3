function getCsrfToken() {
    return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
}

// Configurar o token CSRF para todas as requisições AJAX
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader("X-CSRFToken", getCsrfToken());
        }
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const swotAnalysisElement = document.getElementById('swotAnalysis');
    const swotId = swotAnalysisElement ? swotAnalysisElement.dataset.swotId : null;
    const loadingSpinner = document.getElementById('loadingSpinner');
    const analysisCard = document.getElementById('analysisCard');
    const swotItemModalElement = document.getElementById('swotItemModal');
    const swotItemModal = swotItemModalElement ? new bootstrap.Modal(swotItemModalElement) : null;
    const saveSwotItemBtn = document.getElementById('saveSwotItemBtn');

    // Adicionar item
    document.querySelectorAll('.add-item').forEach(button => {
        button.addEventListener('click', function() {
            const category = this.dataset.category;
            const input = document.getElementById(`new${category.charAt(0).toUpperCase() + category.slice(1)}`);
            const content = input.value.trim();
            if (content) {
                addSWOTItem(swotId, category, content);
                input.value = '';
            }
        });
    });

    // Remover item
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('remove-item')) {
            const itemId = e.target.closest('li').dataset.id;
            
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
                                <p>Tem certeza que deseja excluir este item?</p>
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
                removeSWOTItem(itemId);
            });
        }
    });

    // Editar item
    document.addEventListener('click', function(e) {
        if (e.target && e.target.classList.contains('edit-item')) {
            const li = e.target.closest('li');
            const itemId = li.dataset.id;
            const content = li.querySelector('.swot-item-content').textContent;
            const category = li.closest('.swot-list').dataset.category;
            
            document.getElementById('swotItemContent').value = content;
            document.getElementById('swotItemCategory').value = category;
            
            saveSwotItemBtn.onclick = function() {
                updateSWOTItem(itemId, 
                               document.getElementById('swotItemContent').value,
                               document.getElementById('swotItemCategory').value);
            };
            
            swotItemModal.show();
        }
    });

    // Regenerar SWOT
    document.getElementById('regenerateSwot').addEventListener('click', function() {
        const ideaId = this.dataset.ideaId;
        
        // Criar e exibir o modal de confirmação
        const confirmModal = document.createElement('div');
        confirmModal.innerHTML = `
            <div class="modal fade" id="confirmRegenerateModal" tabindex="-1" aria-labelledby="confirmRegenerateModalLabel" aria-hidden="true">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="confirmRegenerateModalLabel">Confirmar Regeneração</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <p>Tem certeza que deseja regenerar a análise SWOT? Isso substituirá todos os itens existentes.</p>
                            <div id="regenerateLoader" class="text-center" style="display: none;">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Regenerando...</span>
                                </div>
                                <p class="mt-2">Regenerando análise SWOT...</p>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" class="btn btn-danger" id="confirmRegenerateBtn">Regenerar</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(confirmModal);
        
        const modal = new bootstrap.Modal(document.getElementById('confirmRegenerateModal'));
        modal.show();
        
        document.getElementById('confirmRegenerateBtn').addEventListener('click', function() {
            // Mostrar loader e desabilitar botões
            document.getElementById('regenerateLoader').style.display = 'block';
            this.disabled = true;
            document.querySelector('#confirmRegenerateModal .btn-secondary').disabled = true;

            // Fazer uma requisição GET em vez de POST
            window.location.href = `/generate_swot/${ideaId}`;
        });
    });

    // Analisar SWOT com IA
    const analyzeSwotBtn = document.getElementById('analyzeSwot');
    if (analyzeSwotBtn) {
        analyzeSwotBtn.addEventListener('click', function() {
            analyzeSwotWithAI(swotId);
        });
    }

    // Inicializar Sortable para cada lista SWOT
    document.querySelectorAll('.swot-list').forEach(list => {
        new Sortable(list, {
            group: 'shared',
            animation: 150,
            onEnd: function(evt) {
                const itemId = evt.item.getAttribute('data-id');
                const newCategory = evt.to.dataset.category;
                updateSWOTItemCategory(itemId, newCategory);
            }
        });
    });

    // Gerar SWOT
    const generateSwotBtn = document.getElementById('generateSwot');
    const confirmGenerateModal = new bootstrap.Modal(document.getElementById('confirmGenerateModal'));
    const confirmGenerateBtn = document.getElementById('confirmGenerateBtn');

    if (generateSwotBtn) {
        generateSwotBtn.addEventListener('click', function(e) {
            e.preventDefault();
            confirmGenerateModal.show();
        });
    }

    if (confirmGenerateBtn) {
        confirmGenerateBtn.addEventListener('click', function() {
            const ideaId = generateSwotBtn.dataset.ideaId;
            confirmGenerateModal.hide();
            
            // Adicionar loader ao botão
            const originalBtnText = generateSwotBtn.innerHTML;
            generateSwotBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Gerando...';
            generateSwotBtn.disabled = true;
            
            // Fazer uma requisição AJAX em vez de redirecionar
            $.ajax({
                url: `/generate_swot/${ideaId}`,
                method: 'POST',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                },
                success: function(response) {
                    if (response.success) {
                        // Recarregar a página ou atualizar o conteúdo SWOT
                        location.reload();
                    } else {
                        alert('Erro ao gerar SWOT: ' + response.error);
                    }
                },
                error: function() {
                    alert('Erro ao gerar SWOT. Por favor, tente novamente.');
                },
                complete: function() {
                    // Restaurar o botão ao estado original
                    generateSwotBtn.innerHTML = originalBtnText;
                    generateSwotBtn.disabled = false;
                }
            });
        });
    }

    function addSWOTItem(swotId, category, content) {
        fetch('/add_swot_item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ swot_id: swotId, category: category, content: content }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Recarregar a página após a adição bem-sucedida
                location.reload();
            } else {
                console.error('Failed to add SWOT item');
                alert(data.error || 'Falha ao adicionar o item SWOT');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao adicionar o item SWOT');
        });
    }

    function removeSWOTItem(itemId) {
        fetch('/remove_swot_item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ item_id: itemId }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Recarregar a página após a exclusão bem-sucedida
                location.reload();
            } else {
                console.error('Failed to remove SWOT item');
                alert(data.error || 'Falha ao remover o item SWOT');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao remover o item SWOT');
        });
    }

    function updateSWOTItem(itemId, newContent, newCategory) {
        fetch('/update_swot_item', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ 
                item_id: itemId, 
                content: newContent,
                category: newCategory
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const item = document.querySelector(`li[data-id="${itemId}"]`);
                item.querySelector('.swot-item-content').textContent = newContent;
                
                // Se a categoria mudou, mova o item para a nova lista
                const currentList = item.closest('.swot-list');
                const targetList = document.querySelector(`.swot-list[data-category="${newCategory}"]`);
                if (currentList !== targetList) {
                    currentList.removeChild(item);
                    targetList.appendChild(item);
                }
                
                swotItemModal.hide();
            } else {
                console.error('Failed to update SWOT item');
                alert(data.error || 'Falha ao atualizar o item SWOT');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao atualizar o item SWOT');
        });
    }

    function updateSWOTItemCategory(itemId, newCategory) {
        fetch('/update_swot_item_category', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ item_id: itemId, category: newCategory }),
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert(data.error || 'Falha ao atualizar a categoria do item. Por favor, tente novamente.');
                location.reload();
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao atualizar a categoria do item SWOT');
        });
    }

    function analyzeSwotWithAI(swotId) {
        if (!swotId) {
            console.error('SWOT ID não encontrado');
            return;
        }

        const analyzeSwotBtn = document.getElementById('analyzeSwot');
        const originalBtnText = analyzeSwotBtn.innerHTML;
        
        // Alterar o botão para mostrar o loader
        analyzeSwotBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Analisando...';
        analyzeSwotBtn.disabled = true;

        fetch('/analyze_swot', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ swot_id: swotId }),
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                const analysisContent = document.getElementById('analysisContent');
                const analysisTimestamp = document.getElementById('analysisTimestamp');
                analysisContent.innerHTML = data.analysis;
                analysisTimestamp.textContent = data.timestamp;
                analysisCard.style.display = 'block';

                // Adicionar a nova análise ao histórico
                const analysisHistory = document.getElementById('analysisHistoryContent');
                const newAnalysisCard = document.createElement('div');
                newAnalysisCard.className = 'card mb-3';
                newAnalysisCard.innerHTML = `
                    <div class="card-body">
                        <h6 class="card-subtitle mb-2 text-muted">Análise de ${data.timestamp}</h6>
                        <p class="card-text">${data.analysis}</p>
                    </div>
                `;
                analysisHistory.insertBefore(newAnalysisCard, analysisHistory.firstChild);
            } else {
                throw new Error(data.error || 'Falha ao analisar o SWOT.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao analisar o SWOT. Por favor, tente novamente.');
        })
        .finally(() => {
            // Restaurar o botão ao estado original
            analyzeSwotBtn.innerHTML = originalBtnText;
            analyzeSwotBtn.disabled = false;
        });
    }

    function createSWOTItemElement(id, content) {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.setAttribute('data-id', id);
        li.innerHTML = `
            <span class="swot-item-content">${content}</span>
            <div>
                <button class="btn btn-sm btn-outline-primary edit-item" title="Editar">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger remove-item" title="Remover">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        return li;
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
});