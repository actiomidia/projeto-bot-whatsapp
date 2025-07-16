// Conectar ao Socket.IO
const socket = io();

// Elementos do DOM
const statusIndicator = document.getElementById('statusIndicator');
const statusText = statusIndicator.querySelector('.status-text');
const qrSection = document.getElementById('qrSection');
const messageSection = document.getElementById('messageSection');
const qrCode = document.getElementById('qrCode');
const messageForm = document.getElementById('messageForm');
const phoneNumber = document.getElementById('phoneNumber');
const message = document.getElementById('message');
const charCount = document.getElementById('charCount');
const logContainer = document.getElementById('logContainer');
const requestQRBtn = document.getElementById('requestQR');
const logoutBtn = document.getElementById('logout');
const getInfoBtn = document.getElementById('getInfo');
const modal = document.getElementById('messageModal');
const modalTitle = document.getElementById('modalTitle');
const modalMessage = document.getElementById('modalMessage');
const closeModal = document.querySelector('.close');

// Elementos do envio em massa
const bulkForm = document.getElementById('bulkForm');
const numbersList = document.getElementById('numbersList');
const bulkMessage = document.getElementById('bulkMessage');
const bulkCharCount = document.getElementById('bulkCharCount');
const numbersCount = document.getElementById('numbersCount');
const delayInput = document.getElementById('delay');
const stopOnErrorInput = document.getElementById('stopOnError');
const bulkProgress = document.getElementById('bulkProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const progressPercentage = document.getElementById('progressPercentage');
const sentCount = document.getElementById('sentCount');
const failedCount = document.getElementById('failedCount');

// Elementos de grupos
const groupForm = document.getElementById('groupForm');
const groupsList = document.getElementById('groupsList');
const selectedGroupsDisplay = document.getElementById('selectedGroupsDisplay');
const groupsSelectedCount = document.getElementById('groupsSelectedCount');
const groupMessage = document.getElementById('groupMessage');
const groupCharCount = document.getElementById('groupCharCount');
const groupDelay = document.getElementById('groupDelay');
const groupProgress = document.getElementById('groupProgress');
const groupProgressFill = document.getElementById('groupProgressFill');
const groupProgressText = document.getElementById('groupProgressText');
const groupProgressPercentage = document.getElementById('groupProgressPercentage');
const groupSentCount = document.getElementById('groupSentCount');
const groupFailedCount = document.getElementById('groupFailedCount');
const refreshGroupsBtn = document.getElementById('refreshGroups');

// Tabs
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

// Estado da aplicação
let isConnected = false;
let isSendingBulk = false;
let availableGroups = [];
let selectedGroups = [];

// Funções auxiliares
function updateStatus(connected) {
    isConnected = connected;
    if (connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Conectado';
        qrSection.style.display = 'none';
        messageSection.style.display = 'block';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Desconectado';
        qrSection.style.display = 'block';
        messageSection.style.display = 'none';
    }
}

function addLog(message, type = 'info') {
    if (!logContainer) return;
    
    const entry = document.createElement('p');
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logContainer.insertBefore(entry, logContainer.firstChild);
    
    // Manter apenas os últimos 50 logs
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

function showModal(title, message) {
    if (modalTitle && modalMessage && modal) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modal.style.display = 'block';
    }
}

function formatPhoneNumber(number) {
    // Remove todos os caracteres não numéricos
    return number.replace(/\D/g, '');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event Listeners do Socket.IO
socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    addLog('Conectado ao servidor', 'success');
});

socket.on('disconnect', () => {
    console.log('Socket desconectado');
    addLog('Desconectado do servidor', 'error');
    updateStatus(false);
});

socket.on('qr', (qrDataURL) => {
    console.log('QR Code recebido no frontend:', qrDataURL ? 'Sim' : 'Não');
    if (qrDataURL && qrCode) {
        qrCode.innerHTML = `<img src="${qrDataURL}" alt="QR Code">`;
        if (requestQRBtn) requestQRBtn.style.display = 'none';
        addLog('QR Code recebido - escaneie com seu WhatsApp', 'success');
    } else if (qrCode) {
        qrCode.innerHTML = '<p>QR Code escaneado com sucesso!</p>';
    }
});

socket.on('ready', () => {
    addLog('WhatsApp conectado e pronto!', 'success');
    updateStatus(true);
});

socket.on('authenticated', () => {
    addLog('WhatsApp autenticado com sucesso!', 'success');
});

socket.on('auth_failure', (msg) => {
    addLog(`Falha na autenticação: ${msg}`, 'error');
    updateStatus(false);
    if (requestQRBtn) requestQRBtn.style.display = 'block';
});

socket.on('disconnected', (reason) => {
    addLog(`WhatsApp desconectado: ${reason}`, 'error');
    updateStatus(false);
});

socket.on('message', (msg) => {
    addLog(msg);
});

socket.on('message-status', (result) => {
    if (result.success) {
        addLog(`Mensagem enviada para ${result.to}`, 'success');
        showModal('Sucesso', result.message);
        // Limpar formulário
        if (phoneNumber) phoneNumber.value = '';
        if (message) message.value = '';
        if (charCount) charCount.textContent = '0 caracteres';
    } else {
        addLog(`Erro ao enviar mensagem: ${result.error}`, 'error');
        showModal('Erro', result.error);
    }
});

socket.on('incoming-message', (data) => {
    addLog(`Mensagem recebida de ${data.from}: ${data.body}`, 'warning');
});

socket.on('change_state', (state) => {
    addLog(`Estado alterado para: ${state}`);
});

socket.on('loading_screen', (data) => {
    addLog(`Carregando: ${data.percent}% - ${data.message}`);
});

socket.on('connection-status', (status) => {
    updateStatus(status.isReady);
    if (!status.isReady && !status.hasQR && requestQRBtn) {
        requestQRBtn.style.display = 'block';
    }
});

// Event Listeners do Socket.IO para envio em massa
socket.on('bulk-progress', (data) => {
    if (progressFill) progressFill.style.width = `${data.percentage}%`;
    if (progressText) progressText.textContent = `${data.current}/${data.total}`;
    if (progressPercentage) progressPercentage.textContent = `${data.percentage}%`;
    if (sentCount) sentCount.textContent = data.sent;
    if (failedCount) failedCount.textContent = data.failed;
});

socket.on('bulk-message-sent', (data) => {
    addLog(`✅ Mensagem enviada para ${data.number} (${data.index}/${data.total})`, 'success');
});

socket.on('bulk-message-failed', (data) => {
    addLog(`❌ Falha ao enviar para ${data.number}: ${data.error}`, 'error');
});

socket.on('bulk-complete', (summary) => {
    isSendingBulk = false;
    const submitBtn = bulkForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Iniciar Envio em Massa';
    }
    
    const duration = new Date(summary.endTime) - new Date(summary.startTime);
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    addLog(`📊 Envio em massa concluído: ${summary.sent} enviados, ${summary.failed} falharam em ${minutes}m ${seconds}s`, 'warning');
    
    showModal('Envio em Massa Concluído', 
        `Total: ${summary.total} números\n` +
        `Enviados: ${summary.sent}\n` +
        `Falhas: ${summary.failed}\n` +
        `Tempo: ${minutes}m ${seconds}s`
    );
});

// Event Listeners do Socket.IO para grupos
socket.on('group-bulk-progress', (data) => {
    if (groupProgressFill) groupProgressFill.style.width = `${data.percentage}%`;
    if (groupProgressText) groupProgressText.textContent = `${data.current}/${data.total}`;
    if (groupProgressPercentage) groupProgressPercentage.textContent = `${data.percentage}%`;
    if (groupSentCount) groupSentCount.textContent = data.sent;
    if (groupFailedCount) groupFailedCount.textContent = data.failed;
});

socket.on('group-message-sent', (data) => {
    addLog(`✅ Mensagem enviada para grupo "${data.groupName}" (${data.index}/${data.total})`, 'success');
});

socket.on('group-message-failed', (data) => {
    addLog(`❌ Falha ao enviar para grupo: ${data.error}`, 'error');
});

socket.on('group-bulk-complete', (summary) => {
    isSendingBulk = false;
    const submitBtn = groupForm?.querySelector('button[type="submit"]');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Grupos Selecionados';
    }
    
    const duration = new Date(summary.endTime) - new Date(summary.startTime);
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    
    addLog(`📊 Envio para grupos concluído: ${summary.sent} enviados, ${summary.failed} falharam em ${minutes}m ${seconds}s`, 'warning');
    
    showModal('Envio para Grupos Concluído', 
        `Total: ${summary.total} grupos\n` +
        `Enviados: ${summary.sent}\n` +
        `Falhas: ${summary.failed}\n` +
        `Tempo: ${minutes}m ${seconds}s`
    );
});

// Event Listeners do DOM
if (messageForm) {
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const phoneValue = formatPhoneNumber(phoneNumber.value);
        const messageValue = message.value.trim();
        
        if (!phoneValue || !messageValue) {
            showModal('Erro', 'Por favor, preencha todos os campos');
            return;
        }
        
        // Validar número (brasileiro)
        if (phoneValue.length < 10 || phoneValue.length > 13) {
            showModal('Erro', 'Número inválido. Use o formato: DDD + número (ex: 21999115639)');
            return;
        }
        
        addLog(`Enviando mensagem para ${phoneValue}...`);
        
        // Enviar via Socket.IO
        socket.emit('send-message', {
            number: phoneValue,
            message: messageValue
        });
    });
}

if (message) {
    message.addEventListener('input', () => {
        const length = message.value.length;
        if (charCount) charCount.textContent = `${length} caracteres`;
    });
}

if (requestQRBtn) {
    requestQRBtn.addEventListener('click', () => {
        socket.emit('request-qr');
        requestQRBtn.style.display = 'none';
        if (qrCode) qrCode.innerHTML = '<div class="loader"></div><p>Gerando novo QR Code...</p>';
    });
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm('Tem certeza que deseja desconectar o WhatsApp?')) {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                const data = await response.json();
                
                if (data.success) {
                    addLog('Logout realizado com sucesso', 'success');
                    updateStatus(false);
                    location.reload();
                } else {
                    showModal('Erro', 'Erro ao fazer logout');
                }
            } catch (error) {
                showModal('Erro', 'Erro ao fazer logout');
            }
        }
    });
}

if (getInfoBtn) {
    getInfoBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/api/info');
            const data = await response.json();
            
            if (data.success && data.info) {
                const info = data.info;
                showModal('Informações do WhatsApp', 
                    `Número: ${info.wid.user}\n` +
                    `Nome: ${info.pushname || 'Não definido'}\n` +
                    `Plataforma: ${info.platform || 'Desconhecida'}`
                );
            } else {
                showModal('Erro', 'Não foi possível obter as informações');
            }
        } catch (error) {
            showModal('Erro', 'Erro ao buscar informações');
        }
    });
}

if (closeModal) {
    closeModal.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Event Listeners para Tabs
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        console.log('🔄 Tab clicada:', tabName);
        
        // Atualizar botões
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // Atualizar conteúdo
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        if (tabName === 'single') {
            document.getElementById('singleTab').classList.add('active');
        } else if (tabName === 'bulk') {
            document.getElementById('bulkTab').classList.add('active');
        } else if (tabName === 'groups') {
            document.getElementById('groupsTab').classList.add('active');
            
            // Carregar grupos se WhatsApp estiver conectado
            if (isConnected) {
                console.log('📱 Tab grupos selecionada - carregando grupos...');
                loadGroups();
            } else {
                console.log('📵 WhatsApp não conectado');
                if (groupsList) groupsList.innerHTML = '<p class="error">WhatsApp não está conectado</p>';
            }
        }
    });
});

// Event Listener do formulário de envio em massa
if (bulkForm) {
    bulkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isSendingBulk) {
            showModal('Aviso', 'Já existe um envio em massa em andamento');
            return;
        }
        
        const numbersText = numbersList.value.trim();
        const messageText = bulkMessage.value.trim();
        const delay = parseInt(delayInput.value) * 1000;
        const stopOnError = stopOnErrorInput.checked;
        
        if (!numbersText || !messageText) {
            showModal('Erro', 'Por favor, preencha todos os campos');
            return;
        }
        
        // Processar números
        const numbers = numbersText
            .split('\n')
            .map(num => formatPhoneNumber(num.trim()))
            .filter(num => num.length >= 10);
        
        if (numbers.length === 0) {
            showModal('Erro', 'Nenhum número válido encontrado');
            return;
        }
        
        if (numbers.length > 100) {
            showModal('Erro', 'Máximo de 100 números por vez');
            return;
        }
        
        // Confirmar envio
        const confirmSend = window.confirm(
            `Confirma o envio para ${numbers.length} números?\n\n` +
            `Tempo estimado: ${Math.ceil(numbers.length * delay / 60000)} minutos`
        );
        
        if (!confirmSend) return;
        
        // Iniciar envio
        isSendingBulk = true;
        if (bulkProgress) bulkProgress.style.display = 'block';
        const submitBtn = bulkForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }
        
        // Resetar progresso
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0/0';
        if (progressPercentage) progressPercentage.textContent = '0%';
        if (sentCount) sentCount.textContent = '0';
        if (failedCount) failedCount.textContent = '0';
        
        addLog(`Iniciando envio em massa para ${numbers.length} números...`, 'warning');
        
        try {
            const response = await fetch('/api/send-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    numbers,
                    message: messageText,
                    delay,
                    stopOnError
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
        } catch (error) {
            isSendingBulk = false;
            const submitBtn = bulkForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Iniciar Envio em Massa';
            }
            showModal('Erro', error.message);
            addLog(`Erro ao iniciar envio em massa: ${error.message}`, 'error');
        }
    });
}

// Contador de números
if (numbersList) {
    numbersList.addEventListener('input', () => {
        const numbers = numbersList.value
            .split('\n')
            .map(num => num.trim())
            .filter(num => num.length >= 10);
        
        if (numbersCount) numbersCount.textContent = `${numbers.length} números`;
    });
}

// Contador de caracteres para mensagem em massa
if (bulkMessage) {
    bulkMessage.addEventListener('input', () => {
        const length = bulkMessage.value.length;
        if (bulkCharCount) bulkCharCount.textContent = `${length} caracteres`;
    });
}

// Auto-resize das textareas
if (numbersList) {
    numbersList.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 300) + 'px';
    });
}

if (bulkMessage) {
    bulkMessage.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

if (message) {
    message.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
    });
}

// Funções de Grupos
async function loadGroups() {
    try {
        console.log('🔄 Carregando grupos...');
        
        if (groupsList) groupsList.innerHTML = '<div class="loader"></div><p>Carregando grupos...</p>';
        
        const response = await fetch('/api/groups', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('📡 Resposta da API /api/groups:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📋 Dados dos grupos recebidos:', data);
        
        if (data.success) {
            availableGroups = data.groups;
            displayGroups();
            addLog(`${data.count} grupos carregados`, 'success');
            console.log('✅ Grupos carregados com sucesso:', data.count);
        } else {
            throw new Error(data.error || 'Erro desconhecido ao carregar grupos');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar grupos:', error);
        if (groupsList) groupsList.innerHTML = `<p class="error">Erro ao carregar grupos: ${error.message}</p>`;
        addLog(`Erro ao carregar grupos: ${error.message}`, 'error');
    }
}

function displayGroups() {
    if (!groupsList) return;
    
    if (availableGroups.length === 0) {
        groupsList.innerHTML = '<p>Você não participa de nenhum grupo</p>';
        return;
    }
    
    groupsList.innerHTML = '';
    
    availableGroups.forEach(group => {
        const groupItem = document.createElement('div');
        groupItem.className = 'group-item';
        groupItem.dataset.groupId = group.id;
        
        const isSelected = selectedGroups.some(g => g.id === group.id);
        if (isSelected) {
            groupItem.classList.add('selected');
        }
        
        groupItem.innerHTML = `
            <input type="checkbox" class="group-checkbox" ${isSelected ? 'checked' : ''}>
            <div class="group-info">
                <div class="group-name">${escapeHtml(group.name)}</div>
                <div class="group-details">
                    <span><i class="fas fa-users"></i> ${group.participantsCount} membros</span>
                    ${group.isReadOnly ? '<span><i class="fas fa-lock"></i> Somente leitura</span>' : ''}
                    ${group.isMuted ? '<span><i class="fas fa-volume-mute"></i> Silenciado</span>' : ''}
                </div>
            </div>
        `;
        
        groupItem.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                const checkbox = groupItem.querySelector('.group-checkbox');
                checkbox.checked = !checkbox.checked;
            }
            toggleGroupSelection(group);
        });
        
        groupsList.appendChild(groupItem);
    });
}

function toggleGroupSelection(group) {
    const index = selectedGroups.findIndex(g => g.id === group.id);
    
    if (index === -1) {
        selectedGroups.push(group);
    } else {
        selectedGroups.splice(index, 1);
    }
    
    updateSelectedGroupsDisplay();
    
    // Atualizar visual
    if (groupsList) {
        const groupItem = groupsList.querySelector(`[data-group-id="${group.id}"]`);
        if (groupItem) {
            groupItem.classList.toggle('selected');
            const checkbox = groupItem.querySelector('.group-checkbox');
            checkbox.checked = index === -1;
        }
    }
}

function updateSelectedGroupsDisplay() {
    if (groupsSelectedCount) {
        groupsSelectedCount.textContent = `${selectedGroups.length} grupos selecionados`;
    }
    
    if (selectedGroupsDisplay) {
        if (selectedGroups.length === 0) {
            selectedGroupsDisplay.innerHTML = '<p class="no-selection">Nenhum grupo selecionado</p>';
        } else {
            selectedGroupsDisplay.innerHTML = selectedGroups.map(group => `
                <span class="selected-group-tag">
                    ${escapeHtml(group.name)}
                    <i class="fas fa-times" onclick="removeGroupSelection('${group.id}')"></i>
                </span>
            `).join('');
        }
    }
}

function removeGroupSelection(groupId) {
    const group = selectedGroups.find(g => g.id === groupId);
    if (group) {
        toggleGroupSelection(group);
    }
}

// Event Listeners para Grupos
if (refreshGroupsBtn) {
    refreshGroupsBtn.addEventListener('click', () => {
        console.log('🔄 Refresh grupos clicado');
        loadGroups();
    });
}

if (groupMessage) {
    groupMessage.addEventListener('input', () => {
        const length = groupMessage.value.length;
        if (groupCharCount) groupCharCount.textContent = `${length} caracteres`;
        groupMessage.style.height = 'auto';
        groupMessage.style.height = groupMessage.scrollHeight + 'px';
    });
}

if (groupForm) {
    groupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isSendingBulk) {
            showModal('Aviso', 'Já existe um envio em andamento');
            return;
        }
        
        if (selectedGroups.length === 0) {
            showModal('Erro', 'Selecione pelo menos um grupo');
            return;
        }
        
        const messageText = groupMessage.value.trim();
        const delay = parseInt(groupDelay.value) * 1000;
        
        if (!messageText) {
            showModal('Erro', 'Digite uma mensagem');
            return;
        }
        
        const confirmSend = window.confirm(
            `Confirma o envio para ${selectedGroups.length} grupos?\n\n` +
            `Tempo estimado: ${Math.ceil(selectedGroups.length * delay / 60000)} minutos`
        );
        
        if (!confirmSend) return;
        
        isSendingBulk = true;
        if (groupProgress) groupProgress.style.display = 'block';
        const submitBtn = groupForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
        }
        
        // Resetar progresso
        if (groupProgressFill) groupProgressFill.style.width = '0%';
        if (groupProgressText) groupProgressText.textContent = '0/0';
        if (groupProgressPercentage) groupProgressPercentage.textContent = '0%';
        if (groupSentCount) groupSentCount.textContent = '0';
        if (groupFailedCount) groupFailedCount.textContent = '0';
        
        const groupIds = selectedGroups.map(g => g.id);
        
        addLog(`Iniciando envio para ${selectedGroups.length} grupos...`, 'warning');
        
        try {
            const response = await fetch('/api/send-to-groups', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    groupIds,
                    message: messageText,
                    delay,
                    stopOnError: false
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
        } catch (error) {
            isSendingBulk = false;
            const submitBtn = groupForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar para Grupos Selecionados';
            }
            showModal('Erro', error.message);
            addLog(`Erro ao iniciar envio para grupos: ${error.message}`, 'error');
        }
    });
}

// Adicionar função window global para remover seleção
window.removeGroupSelection = removeGroupSelection;

// Verificar status inicial
socket.emit('check-status');

// Formatar número enquanto digita
if (phoneNumber) {
    phoneNumber.addEventListener('input', (e) => {
        e.target.value = formatPhoneNumber(e.target.value);
    });
}

// Adicionar log inicial
addLog('Sistema iniciado. Aguardando conexão com WhatsApp...');

// Debug: Verificar se Socket.IO está funcionando
setTimeout(() => {
    if (socket.connected) {
        console.log('Socket.IO conectado corretamente');
        addLog('Socket.IO conectado', 'success');
    } else {
        console.error('Socket.IO NÃO está conectado');
        addLog('Erro: Socket.IO não conectado', 'error');
    }
}, 2000);