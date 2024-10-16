document.addEventListener('DOMContentLoaded', function() {
    const ideaId = window.location.pathname.split('/').pop();
    let expensesChart;
    const editExpenseModal = new bootstrap.Modal(document.getElementById('editExpenseModal'));

    // Carregar gastos existentes
    loadExpenses();

    // Adicionar novo gasto
    document.getElementById('addExpenseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const expense = getExpenseFromForm('addExpenseForm');
        addExpense(expense);
    });

    // Adicionar nova categoria
    document.getElementById('addNewCategory').addEventListener('click', addNewCategory);

    // Carregar gastos
    function loadExpenses() {
        fetch(`/api/expenses/${ideaId}`)
            .then(handleResponse)
            .then(expenses => {
                displayExpenses(expenses);
                updateChart(expenses);
            })
            .catch(handleError);
    }

    // Adicionar novo gasto
    function addExpense(expense) {
        fetch(`/api/expenses/${ideaId}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(expense),
        })
        .then(handleResponse)
        .then(data => {
            if (data.success) {
                loadExpenses();
                document.getElementById('addExpenseForm').reset();
            } else {
                throw new Error(data.error || 'Erro ao adicionar gasto');
            }
        })
        .catch(handleError);
    }

    // Exibir gastos na tabela
    function displayExpenses(expenses) {
        const tbody = document.getElementById('expensesList');
        tbody.innerHTML = '';
        expenses.forEach(expense => {
            const tr = createExpenseRow(expense);
            tbody.appendChild(tr);
        });
    }

    function createExpenseRow(expense) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${expense.description}</td>
            <td>R$ ${expense.amount.toFixed(2)}</td>
            <td>${new Date(expense.date).toLocaleDateString()}</td>
            <td>${expense.category}</td>
            <td>${expense.tags ? expense.tags.join(', ') : ''}</td>
            <td class="text-center">
                <button class="btn btn-sm btn-danger delete-expense" data-id="${expense.id}">Excluir</button>
            </td>
        `;
        tr.querySelector('.delete-expense').addEventListener('click', () => deleteExpense(expense.id));
        return tr;
    }

    function deleteExpense(expenseId) {
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
                            <p>Tem certeza que deseja excluir este gasto?</p>
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
            fetch(`/api/expenses/${expenseId}`, { 
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                }
            })
            .then(handleResponse)
            .then(() => loadExpenses())
            .catch(handleError);
        });
    }

    function updateChart(expenses) {
        const ctx = document.getElementById('expensesChart').getContext('2d');
        const categoryTotals = expenses.reduce((acc, expense) => {
            acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
            return acc;
        }, {});

        const data = {
            labels: Object.keys(categoryTotals),
            datasets: [{
                data: Object.values(categoryTotals),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'
                ]
            }]
        };

        if (expensesChart) {
            expensesChart.destroy();
        }

        expensesChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Distribuição de Gastos por Categoria'
                    }
                }
            }
        });
    }

    function addNewCategory() {
        const newCategoryName = document.getElementById('newCategory').value.trim();
        if (newCategoryName) {
            fetch('/api/categories', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
                body: JSON.stringify({ name: newCategoryName }),
            })
            .then(handleResponse)
            .then(data => {
                if (data.success) {
                    updateCategorySelect(data.id, data.name);
                    document.getElementById('newCategory').value = '';
                } else {
                    throw new Error(data.error || 'Erro ao adicionar categoria');
                }
            })
            .catch(handleError);
        }
    }

    function updateCategorySelect(id, name) {
        const categorySelect = document.getElementById('category');
        const option = document.createElement('option');
        option.value = id;
        option.textContent = name;
        categorySelect.appendChild(option);
        categorySelect.value = id;
    }

    function getExpenseFromForm(formId) {
        const form = document.getElementById(formId);
        return {
            description: form.querySelector('[name="description"]').value,
            amount: parseFloat(form.querySelector('[name="amount"]').value),
            date: form.querySelector('[name="date"]').value,
            category: form.querySelector('[name="category"]').value,
            tags: form.querySelector('[name="tags"]').value.split(',').map(tag => tag.trim())
        };
    }

    function handleResponse(response) {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || `HTTP error! status: ${response.status}`);
            });
        }
        return response.json();
    }

    function handleError(error) {
        console.error('Error:', error);
        alert(`Ocorreu um erro: ${error.message}. Por favor, tente novamente.`);
    }

    // Analisar gastos com IA
    document.getElementById('analyzeExpenses').addEventListener('click', function() {
        fetch(`/api/expenses/${ideaId}/analyze`, { 
            method: 'POST',
            headers: {
                'X-CSRFToken': getCsrfToken()
            }
        })
            .then(response => response.json())
            .then(data => {
                document.getElementById('analysisResult').innerHTML = `<p>${data.analysis}</p>`;
            })
            .catch(error => console.error('Error:', error));
    });

    const expenseFilter = document.getElementById('expenseFilter');
    const filterType = document.getElementById('filterType');
    const clearFilterBtn = document.getElementById('clearFilterBtn');

    if (expenseFilter && filterType) {
        expenseFilter.addEventListener('input', filterExpenses);
        filterType.addEventListener('change', filterExpenses);
    }

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearFilter);
    }

    function filterExpenses() {
        const filterValue = expenseFilter.value.toLowerCase();
        const filterTypeValue = filterType.value;
        const expenses = document.querySelectorAll('#expensesList tr');

        expenses.forEach(expense => {
            let shouldShow = false;
            const cells = expense.querySelectorAll('td');
            const description = cells[0].textContent.toLowerCase();
            const amount = cells[1].textContent.toLowerCase();
            const date = cells[2].textContent.toLowerCase();
            const category = cells[3].textContent.toLowerCase();
            const tags = cells[4].textContent.toLowerCase();

            switch (filterTypeValue) {
                case 'description':
                    shouldShow = description.includes(filterValue);
                    break;
                case 'amount':
                    shouldShow = amount.includes(filterValue);
                    break;
                case 'date':
                    shouldShow = date.includes(filterValue);
                    break;
                case 'category':
                    shouldShow = category.includes(filterValue);
                    break;
                case 'tag':
                    shouldShow = tags.includes(filterValue);
                    break;
                default:
                    shouldShow = description.includes(filterValue) ||
                                 amount.includes(filterValue) ||
                                 date.includes(filterValue) ||
                                 category.includes(filterValue) ||
                                 tags.includes(filterValue);
            }

            expense.style.display = shouldShow ? '' : 'none';
        });
    }

    function clearFilter() {
        expenseFilter.value = '';
        filterType.selectedIndex = 0;
        const expenses = document.querySelectorAll('#expensesList tr');
        expenses.forEach(expense => {
            expense.style.display = '';
        });
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
});
