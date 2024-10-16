document.addEventListener('DOMContentLoaded', function() {
    const customersTable = document.getElementById('customersTable');
    const addCustomerBtn = document.getElementById('addCustomerBtn');
    const customerModalElement = document.getElementById('customerModal');
    const saveCustomerBtn = document.getElementById('saveCustomerBtn');
    const whatsappModalElement = document.getElementById('whatsappModal');
    const sendWhatsappBtn = document.getElementById('sendWhatsappBtn');
    const selectAllCustomers = document.getElementById('selectAllCustomers');
    const sendBulkEmailBtn = document.getElementById('sendBulkEmailBtn');
    const bulkEmailModalElement = document.getElementById('bulkEmailModal');
    const sendBulkEmailConfirmBtn = document.getElementById('sendBulkEmailConfirmBtn');
    const improveEmailBtn = document.getElementById('improveEmailBtn');
    const emailSubjectInput = document.getElementById('emailSubject');
    const emailContentTextarea = document.getElementById('emailContent');

    let customerModal, whatsappModal, bulkEmailModal, deleteConfirmModal;
    let customerIdToDelete;

    // Mova a inicialização dos modais para dentro do evento DOMContentLoaded
    function initializeModals() {
        if (customerModalElement) {
            customerModal = new bootstrap.Modal(customerModalElement);
        }
        if (whatsappModalElement) {
            whatsappModal = new bootstrap.Modal(whatsappModalElement);
        }
        if (bulkEmailModalElement) {
            bulkEmailModal = new bootstrap.Modal(bulkEmailModalElement);
        }
        
        const deleteConfirmModalElement = document.getElementById('deleteConfirmModal');
        if (deleteConfirmModalElement) {
            deleteConfirmModal = new bootstrap.Modal(deleteConfirmModalElement);
        } else {
            console.error('Elemento do modal de confirmação de exclusão não encontrado');
        }
    }

    initializeModals();

    loadCustomers();

    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', () => {
            document.getElementById('customerForm').reset();
            document.getElementById('customerId').value = '';
            document.getElementById('customerModalLabel').textContent = 'Adicionar Cliente';
            customerModal.show();
        });
    }

    if (saveCustomerBtn) {
        saveCustomerBtn.addEventListener('click', saveCustomer);
    }
    if (sendWhatsappBtn) {
        sendWhatsappBtn.addEventListener('click', sendWhatsappMessage);
    }
    if (selectAllCustomers) {
        selectAllCustomers.addEventListener('change', toggleAllCustomers);
    }
    if (sendBulkEmailBtn) {
        sendBulkEmailBtn.addEventListener('click', () => bulkEmailModal.show());
    }
    if (sendBulkEmailConfirmBtn) {
        sendBulkEmailConfirmBtn.addEventListener('click', sendBulkEmail);
    }
    if (improveEmailBtn) {
        improveEmailBtn.addEventListener('click', improveEmailText);
    }

    function loadCustomers() {
        fetch(`/api/customers/${getIdeaId()}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    const tbody = customersTable.querySelector('tbody');
                    tbody.innerHTML = '';
                    data.customers.forEach(customer => {
                        const tr = createCustomerRow(customer);
                        tbody.appendChild(tr);
                    });
                } else {
                    throw new Error(data.error || 'Erro ao carregar clientes');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao carregar os clientes. Por favor, tente novamente.');
            });
    }

    function createCustomerRow(customer) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input type="checkbox" class="customer-select" data-id="${customer.id}"></td>
            <td>${customer.name}</td>
            <td>${customer.email || ''}</td>
            <td>${customer.phone || ''}</td>
            <td>${customer.company || ''}</td>
            <td>${customer.category || ''}</td>
            <td>
                <button class="btn btn-sm btn-primary edit-customer" data-id="${customer.id}">Editar</button>
                <button class="btn btn-sm btn-danger delete-customer" data-id="${customer.id}">Excluir</button>
                <button class="btn btn-sm btn-success whatsapp-customer" data-id="${customer.id}">WhatsApp</button>
            </td>
        `;

        tr.querySelector('.edit-customer').addEventListener('click', () => editCustomer(customer.id));
        tr.querySelector('.delete-customer').addEventListener('click', () => deleteCustomer(customer.id));
        tr.querySelector('.whatsapp-customer').addEventListener('click', () => openWhatsappModal(customer.id));

        return tr;
    }

    function viewCustomerDetails(customerId) {
        fetch(`/api/customers/${customerId}`)
            .then(response => response.json())
            .then(customer => {
                const modalBody = document.querySelector('#customerDetailsModal .modal-body');
                modalBody.innerHTML = `
                    <p><strong>Nome:</strong> ${customer.name}</p>
                    <p><strong>Email:</strong> ${customer.email || 'N/A'}</p>
                    <p><strong>Telefone:</strong> ${customer.phone || 'N/A'}</p>
                    <p><strong>Empresa:</strong> ${customer.company || 'N/A'}</p>
                    <p><strong>Categoria:</strong> ${customer.category || 'N/A'}</p>
                    <p><strong>Endereço:</strong> ${customer.address || 'N/A'}</p>
                    <p><strong>Notas:</strong> ${customer.notes || 'N/A'}</p>
                    <p><strong>Facebook:</strong> ${customer.facebook || 'N/A'}</p>
                    <p><strong>Instagram:</strong> ${customer.instagram || 'N/A'}</p>
                    <p><strong>LinkedIn:</strong> ${customer.linkedin || 'N/A'}</p>
                    <p><strong>Twitter:</strong> ${customer.twitter || 'N/A'}</p>
                `;
                customerDetailsModal.show();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao carregar os detalhes do cliente. Por favor, tente novamente.');
            });
    }

    function saveCustomer() {
        const customerId = document.getElementById('customerId').value;
        const customerData = {
            name: document.getElementById('customerName').value,
            email: document.getElementById('customerEmail').value,
            phone: document.getElementById('customerPhone').value,
            company: document.getElementById('customerCompany').value,
            category: document.getElementById('customerCategory').value,
            address: document.getElementById('customerAddress').value,
            notes: document.getElementById('customerNotes').value,
            facebook: document.getElementById('customerFacebook').value,
            instagram: document.getElementById('customerInstagram').value,
            linkedin: document.getElementById('customerLinkedin').value,
            twitter: document.getElementById('customerTwitter').value
        };

        const url = customerId ? `/api/customers/${customerId}` : `/api/customers/${getIdeaId()}`;
        const method = customerId ? 'PUT' : 'POST';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(customerData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw err; });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                customerModal.hide();
                loadCustomers();
            } else {
                throw new Error(data.error || 'Erro ao salvar cliente');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert(`Ocorreu um erro ao salvar o cliente: ${error.message}`);
        });
    }

    function editCustomer(customerId) {
        fetch(`/api/customers/${customerId}`)
            .then(response => response.json())
            .then(customer => {
                document.getElementById('customerId').value = customer.id;
                document.getElementById('customerName').value = customer.name;
                document.getElementById('customerEmail').value = customer.email || '';
                document.getElementById('customerPhone').value = customer.phone || '';
                document.getElementById('customerCompany').value = customer.company || '';
                document.getElementById('customerCategory').value = customer.category || '';
                document.getElementById('customerAddress').value = customer.address || '';
                document.getElementById('customerNotes').value = customer.notes || '';
                document.getElementById('customerFacebook').value = customer.facebook || '';
                document.getElementById('customerInstagram').value = customer.instagram || '';
                document.getElementById('customerLinkedin').value = customer.linkedin || '';
                document.getElementById('customerTwitter').value = customer.twitter || '';
                customerModal.show();
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao carregar os dados do cliente. Por favor, tente novamente.');
            });
    }

    function deleteCustomer(customerId) {
        customerIdToDelete = customerId;
        if (deleteConfirmModal) {
            deleteConfirmModal.show();
        } else {
            console.error('Modal de confirmação de exclusão não inicializado');
            if (confirm('Tem certeza que deseja excluir este cliente?')) {
                confirmDeleteCustomer();
            }
        }
    }

    function confirmDeleteCustomer() {
        if (customerIdToDelete) {
            fetch(`/api/customers/${customerIdToDelete}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRFToken': getCsrfToken()
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    if (deleteConfirmModal) {
                        deleteConfirmModal.hide();
                    }
                    loadCustomers();
                } else {
                    throw new Error(data.error || 'Erro ao excluir cliente');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert('Ocorreu um erro ao excluir o cliente. Por favor, tente novamente.');
            });
        } else {
            console.error('ID do cliente a ser excluído não encontrado');
        }
    }

    // Adicione este event listener para o botão de confirmação de exclusão
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', confirmDeleteCustomer);
    } else {
        console.error('Botão de confirmação de exclusão não encontrado');
    }

    function openWhatsappModal(customerId) {
        document.getElementById('whatsappCustomerId').value = customerId;
        whatsappModal.show();
    }

    function sendWhatsappMessage() {
        const customerId = document.getElementById('whatsappCustomerId').value;
        const message = document.getElementById('whatsappMessage').value;

        fetch(`/api/customers/${customerId}/send_whatsapp`, {
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
                alert('Mensagem agendada com sucesso!');
                whatsappModal.hide();
            } else {
                throw new Error(data.error || 'Erro ao enviar mensagem');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao enviar a mensagem. Por favor, tente novamente.');
        });
    }

    function getIdeaId() {
        return window.location.pathname.split('/').pop();
    }

    function getCsrfToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }

    function toggleAllCustomers() {
        const checkboxes = document.querySelectorAll('.customer-select');
        checkboxes.forEach(checkbox => checkbox.checked = selectAllCustomers.checked);
        updateBulkEmailButton();
    }

    function updateBulkEmailButton() {
        const selectedCustomers = document.querySelectorAll('.customer-select:checked');
        sendBulkEmailBtn.disabled = selectedCustomers.length === 0;
    }

    function sendBulkEmail() {
        const selectedCustomers = Array.from(document.querySelectorAll('.customer-select:checked')).map(checkbox => checkbox.dataset.id);
        const subject = document.getElementById('emailSubject').value;
        const content = document.getElementById('emailContent').value;

        fetch(`/api/customers/${getIdeaId()}/send_bulk_email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                customer_ids: selectedCustomers,
                subject: subject,
                content: content
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('E-mails enviados com sucesso!');
                bulkEmailModal.hide();
            } else {
                throw new Error(data.error || 'Erro ao enviar e-mails em massa');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao enviar os e-mails em massa. Por favor, tente novamente.');
        });
    }

    function improveEmailText() {
        const subject = emailSubjectInput.value;
        const content = emailContentTextarea.value;

        fetch('/api/improve_email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({ subject, content })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                emailSubjectInput.value = data.improved_subject;
                emailContentTextarea.value = data.improved_content;
                alert('O texto do e-mail foi melhorado com sucesso!');
            } else {
                throw new Error(data.error || 'Erro ao melhorar o texto do e-mail');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Ocorreu um erro ao melhorar o texto do e-mail. Por favor, tente novamente.');
        });
    }
});