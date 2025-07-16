// license.js - Versão SIMPLES (só verificação inicial)
class LicenseManager {
    constructor() {
        this.licenseModal = document.getElementById('licenseModal');
        this.licenseStatus = document.getElementById('licenseStatus');
        this.licenseStatusText = document.getElementById('licenseStatusText');
        this.licenseKeyInput = document.getElementById('licenseKeyInput');
        this.validateLicenseBtn = document.getElementById('validateLicenseBtn');
        this.licenseMessage = document.getElementById('licenseMessage');
        this.licenseInfo = document.getElementById('licenseInfo');
        this.mainContent = document.getElementById('mainContent');
        this.downloadBtn = document.getElementById('downloadBtn');
        
        this.isValidated = false;
        this.currentLicense = null;
        this.validationInProgress = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        
        // ⭐ VERIFICAÇÃO INICIAL ÚNICA
        setTimeout(() => {
            this.initialLicenseCheck();
        }, 500);
        
        // ⭐ SEM VERIFICAÇÃO PERIÓDICA - SÓ NO INÍCIO
    }

    bindEvents() {
        // Validar licença
        this.validateLicenseBtn.addEventListener('click', () => {
            this.validateLicense();
        });

        // Enter no input de licença
        this.licenseKeyInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.validateLicense();
            }
        });

        // Mostrar informações da licença
        document.getElementById('showLicenseInfo').addEventListener('click', () => {
            this.showLicenseModal();
        });

        // Desativar licença
        document.getElementById('deactivateLicense').addEventListener('click', () => {
            this.deactivateLicense();
        });

        // Socket events para licença
        if (typeof socket !== 'undefined') {
            socket.on('license-required', (data) => {
                console.log('🔐 Socket: Licença requerida:', data.message);
                this.showLicenseRequired(data.message);
            });

            socket.on('license-status', (data) => {
                console.log('📊 Socket: Status da licença:', data);
                this.handleLicenseStatus(data);
            });

            socket.on('license-validated', (data) => {
                console.log('✅ Socket: Licença validada:', data);
                this.handleLicenseValidated(data);
            });

            socket.on('license-validation-failed', (data) => {
                console.log('❌ Socket: Validação falhou:', data);
                this.handleLicenseValidationFailed(data);
            });
        }
    }

    /**
     * ⭐ VERIFICAÇÃO INICIAL ÚNICA
     */
    async initialLicenseCheck() {
        console.log('🚀 Verificação inicial da licença...');
        
        try {
            const result = await this.checkLicenseStatus();
            
            if (result && result.valid) {
                console.log('✅ Licença válida na verificação inicial');
                this.waitForSocketAndInitializeWhatsApp();
            } else {
                console.log('❌ Licença inválida na verificação inicial');
            }
        } catch (error) {
            console.error('❌ Erro na verificação inicial:', error);
        }
    }

    /**
     * ⭐ AGUARDAR SOCKET E INICIALIZAR WHATSAPP
     */
    waitForSocketAndInitializeWhatsApp() {
        console.log('⏳ Aguardando socket conectar para inicializar WhatsApp...');
        
        let attempts = 0;
        const maxAttempts = 10;
        
        const checkSocket = () => {
            attempts++;
            
            if (typeof socket !== 'undefined' && socket.connected) {
                console.log('✅ Socket conectado - verificando WhatsApp...');
                this.checkWhatsAppStatus();
            } else if (attempts < maxAttempts) {
                console.log(`⏳ Tentativa ${attempts}/${maxAttempts} - socket ainda não conectado`);
                setTimeout(checkSocket, 1000);
            } else {
                console.log('⚠️ Timeout aguardando socket - tentando mesmo assim...');
                this.checkWhatsAppStatus();
            }
        };
        
        setTimeout(checkSocket, 1000);
    }

    /**
     * ⭐ VERIFICAR STATUS DO WHATSAPP
     */
    async checkWhatsAppStatus() {
        if (typeof socket !== 'undefined' && socket.connected) {
            console.log('📱 Verificando status do WhatsApp...');
            socket.emit('check-status');
        } else {
            console.log('❌ Socket não disponível para verificar WhatsApp');
        }
    }

    /**
     * ⭐ VERIFICAÇÃO SIMPLES (SÓ UMA VEZ)
     */
    async checkLicenseStatus() {
        try {
            console.log('🔍 Verificando status da licença...');
            
            const response = await fetch('/api/license/status?t=' + Date.now(), {
                method: 'GET',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('📡 Resposta do backend:', data);

            if (data.success && data.isValid) {
                console.log('✅ Licença válida confirmada');
                this.handleValidLicense(data.license);
                return { valid: true, license: data.license };
            } else {
                console.log('❌ Licença inválida:', data.message);
                this.showLicenseRequired(data.message || 'Licença inválida');
                return { valid: false, message: data.message };
            }
        } catch (error) {
            console.error('❌ Erro ao verificar licença:', error);
            this.showLicenseRequired('Erro ao verificar licença');
            return { valid: false, message: 'Erro ao verificar licença' };
        }
    }

    /**
     * ⭐ VALIDAÇÃO VIA API
     */
    async validateLicense() {
        if (this.validationInProgress) {
            console.log('⏳ Validação já em andamento...');
            return;
        }

        const licenseKey = this.licenseKeyInput.value.trim();
        
        if (!licenseKey) {
            this.showMessage('Digite uma chave de licença válida', 'error');
            return;
        }

        this.validationInProgress = true;
        this.setLoading(true);
        this.showMessage('Validando licença...', 'info');

        try {
            console.log('🔐 Validando licença:', licenseKey.substring(0, 8) + '****');
            
            const response = await fetch('/api/license/validate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ licenseKey })
            });

            const data = await response.json();
            console.log('📡 Resposta da validação:', data);

            if (data.success) {
                this.handleLicenseValidated(data);
                
                this.isValidated = true;
                this.currentLicense = data.license;
                
                // ⭐ ENVIAR VIA SOCKET PARA INICIALIZAR WHATSAPP
                if (typeof socket !== 'undefined') {
                    console.log('📱 Enviando validação via socket para inicializar WhatsApp...');
                    socket.emit('validate-license', { licenseKey });
                } else {
                    console.log('⚠️ Socket não disponível - tentando verificar WhatsApp...');
                    setTimeout(() => {
                        this.waitForSocketAndInitializeWhatsApp();
                    }, 2000);
                }
                
            } else {
                this.handleLicenseValidationFailed(data);
            }
        } catch (error) {
            console.error('❌ Erro na validação via API:', error);
            
            if (typeof socket !== 'undefined') {
                console.log('🔄 Tentando validação via socket...');
                socket.emit('validate-license', { licenseKey });
            } else {
                this.showMessage('Erro ao conectar com o servidor', 'error');
            }
        } finally {
            this.validationInProgress = false;
            this.setLoading(false);
        }
    }

    /**
     * ⭐ DESATIVAR LICENÇA
     */
    async deactivateLicense() {
        if (!confirm('Tem certeza que deseja desativar a licença? Você precisará validá-la novamente.')) {
            return;
        }

        try {
            console.log('🗑️ Desativando licença...');
            
            const response = await fetch('/api/license/deactivate', {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                this.showMessage('Licença desativada com sucesso', 'success');
                
                this.isValidated = false;
                this.currentLicense = null;
                
                setTimeout(() => {
                    location.reload();
                }, 2000);
            } else {
                this.showMessage('Erro ao desativar licença', 'error');
            }
        } catch (error) {
            console.error('❌ Erro ao desativar licença:', error);
            this.showMessage('Erro ao desativar licença', 'error');
        }
    }

    /**
     * ⭐ PROCESSAR LICENÇA VÁLIDA
     */
    handleValidLicense(license) {
        console.log('✅ Processando licença válida:', license);
        
        this.isValidated = true;
        this.currentLicense = license;
        
        this.hideLicenseModal();
        this.updateLicenseStatus('valid', 'Licença válida');
        this.updateLicenseInfo(license);
        
        if (this.downloadBtn) {
            this.downloadBtn.style.display = 'inline-block';
        }
        
        this.addLog('✅ Licença validada com sucesso');
        
        setTimeout(() => {
            this.waitForSocketAndInitializeWhatsApp();
        }, 1000);
    }

    handleLicenseStatus(data) {
        console.log('📊 Processando status:', data);
        
        if (data.valid) {
            this.handleValidLicense(data.license);
        } else {
            if (!this.isValidated) {
                this.showLicenseRequired('Licença inválida');
            }
        }
    }

    handleLicenseValidated(data) {
        console.log('✅ Licença validada com sucesso:', data);
        
        this.showMessage(data.message, 'success');
        this.handleValidLicense(data.license);
        
        console.log('✅ Licença ativa - sistema pronto!');
    }

    handleLicenseValidationFailed(data) {
        console.log('❌ Validação falhou:', data);
        
        this.showMessage(data.message, 'error');
        this.licenseKeyInput.focus();
        this.licenseInfo.style.display = 'none';
        
        this.isValidated = false;
        this.currentLicense = null;
    }

    /**
     * ⭐ MOSTRAR REQUISIÇÃO DE LICENÇA
     */
    showLicenseRequired(message) {
        console.log('🔐 Licença requerida:', message);
        
        if (this.isValidated) {
            console.log('⚡ Ignorando requisição - licença já validada');
            return;
        }
        
        this.isValidated = false;
        this.currentLicense = null;
        
        this.showLicenseModal();
        this.updateLicenseStatus('invalid', message);
        this.mainContent.classList.add('blurred');
        this.licenseInfo.style.display = 'none';
        
        if (this.downloadBtn) {
            this.downloadBtn.style.display = 'none';
        }
        
        this.addLog('❌ ' + message);
    }

    showLicenseModal() {
        this.licenseModal.classList.add('active');
        this.licenseKeyInput.focus();
        
        if (this.currentLicense && this.isValidated) {
            this.updateLicenseInfo(this.currentLicense);
            this.licenseInfo.style.display = 'block';
        } else {
            this.licenseInfo.style.display = 'none';
        }
    }

    hideLicenseModal() {
        this.licenseModal.classList.remove('active');
        this.mainContent.classList.remove('blurred');
    }

    updateLicenseStatus(type, text) {
        if (this.licenseStatus) {
            this.licenseStatus.className = `license-status ${type}`;
        }
        if (this.licenseStatusText) {
            this.licenseStatusText.textContent = text;
        }
    }

    updateLicenseInfo(license) {
        if (!license) {
            if (this.licenseInfo) {
                this.licenseInfo.style.display = 'none';
            }
            return;
        }

        console.log('📝 Atualizando informações da licença:', license);

        const licenseKeyEl = document.getElementById('licenseKey');
        const licenseExpiresEl = document.getElementById('licenseExpires');
        const licenseUsesEl = document.getElementById('licenseUses');
        const licenseStatusInfoEl = document.getElementById('licenseStatusInfo');

        if (licenseKeyEl) {
            licenseKeyEl.textContent = license.key ? license.key.substring(0, 8) + '****' : 'N/A';
        }
        
        if (licenseExpiresEl) {
            licenseExpiresEl.textContent = license.expires_formatted || 'N/A';
        }
        
        if (licenseUsesEl) {
            licenseUsesEl.textContent = license.max_uses > 0 ? 
                `${license.current_uses}/${license.max_uses}` : 'Ilimitado';
        }
        
        if (licenseStatusInfoEl) {
            const status = license.final_status || license.api_status || 'Ativa';
            licenseStatusInfoEl.textContent = status;
        }
        
        if (this.licenseInfo) {
            this.licenseInfo.style.display = 'block';
        }
    }

    showMessage(message, type) {
        if (this.licenseMessage) {
            this.licenseMessage.innerHTML = `
                <div class="${type}-message">
                    <i class="fas fa-${this.getIconForType(type)}"></i> ${message}
                </div>
            `;
        }
    }

    getIconForType(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'info': 'info-circle',
            'warning': 'exclamation-triangle'
        };
        return icons[type] || 'info-circle';
    }

    setLoading(loading) {
        if (this.validateLicenseBtn) {
            if (loading) {
                this.validateLicenseBtn.disabled = true;
                this.validateLicenseBtn.innerHTML = `
                    <div class="loading-spinner"></div> Validando...
                `;
            } else {
                this.validateLicenseBtn.disabled = false;
                this.validateLicenseBtn.innerHTML = `
                    <i class="fas fa-key"></i> Validar Licença
                `;
            }
        }
    }

    addLog(message) {
        const logContainer = document.getElementById('logContainer');
        if (!logContainer) return;
        
        const timestamp = new Date().toLocaleTimeString('pt-BR');
        const logEntry = document.createElement('p');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `[${timestamp}] ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    /**
     * ⭐ OBTER STATUS ATUAL DA LICENÇA (USADO PELO MODAL DE PAGAMENTO)
     */
    async getCurrentLicenseStatus() {
        try {
            const response = await fetch('/api/license/status');
            const data = await response.json();
            
            if (data.success && data.license) {
                return {
                    status: data.license.final_status || data.license.api_status || 'unknown',
                    licenseKey: data.license.key || ''
                };
            }
            
            return { status: 'unknown', licenseKey: '' };
        } catch (error) {
            console.error('Erro ao obter status:', error);
            return { status: 'unknown', licenseKey: '' };
        }
    }
}

// Aguardar carregamento do DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando sistema de licenças SIMPLES...');
    
    // Inicializar gerenciador de licenças
    window.licenseManager = new LicenseManager();
    
    // Verificar parâmetros da URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('license_required') === 'true') {
        setTimeout(() => {
            if (window.licenseManager) {
                window.licenseManager.showLicenseRequired('Licença necessária para acessar o sistema');
            }
        }, 1000);
    }
    
    // ⭐ INTEGRAÇÃO SIMPLES COM SOCKET
    if (typeof socket !== 'undefined') {
        socket.on('connect', () => {
            console.log('🔌 Socket conectado');
            
            setTimeout(() => {
                if (window.licenseManager?.isValidated) {
                    console.log('📱 Licença já válida - verificando WhatsApp...');
                    socket.emit('check-status');
                }
            }, 1000);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket desconectado');
        });
    }

    // ⭐ INTEGRAR COM OPÇÕES DE PAGAMENTO
    setTimeout(() => {
        if (window.licenseManager) {
            const originalShowLicenseRequired = window.licenseManager.showLicenseRequired;
            
            window.licenseManager.showLicenseRequired = function(message) {
                originalShowLicenseRequired.call(this, message);
                
                this.getCurrentLicenseStatus().then(status => {
                    if (typeof updateModalBasedOnStatus === 'function') {
                        updateModalBasedOnStatus(status.status, status.licenseKey);
                    }
                });
            };
        }
    }, 1000);
});

// ⭐ SEM INTERCEPTADOR - DEIXAR TUDO LIVRE
// O sistema só verifica licença no acesso inicial