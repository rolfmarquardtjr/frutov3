function loadExpenses() {
    fetch('/expenses')
        .then(response => response.json())
        .then(expenses => {
            const tableBody = document.querySelector('#expensesTable tbody');
            tableBody.innerHTML = '';
            expenses.forEach(expense => {
                const row = `
                    <tr>
                        <td>${expense.description}</td>
                        <td>R$ ${expense.amount.toFixed(2)}</td>
                        <td>${expense.date}</td>
                        <td>
                            <button class="btn btn-danger btn-sm" onclick="deleteExpense(${expense.id})">Excluir</button>
                        </td>
                    </tr>
                `;
                tableBody.innerHTML += row;
            });
        })
        .catch(error => console.error('Erro ao carregar despesas:', error));
}

function addExpense(event) {
    event.preventDefault();
    const form = event.target;
    const expense = {
        description: form.description.value,
        amount: parseFloat(form.amount.value),
        date: form.date.value
    };

    fetch('/expense', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(expense)
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('Erro ao adicionar despesa: ' + data.error);
        } else {
            form.reset();
            loadExpenses();
        }
    })
    .catch(error => console.error('Erro:', error));
}

function deleteExpense(id) {
    if (confirm('Tem certeza que deseja excluir esta despesa?')) {
        fetch(`/expense/${id}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                alert('Erro ao excluir despesa: ' + data.error);
            } else {
                loadExpenses();
            }
        })
        .catch(error => console.error('Erro:', error));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadExpenses();
    document.getElementById('addExpenseForm').addEventListener('submit', addExpense);
});
