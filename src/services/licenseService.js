const https = require('https');
const http = require('http');

class LicenseService {
    constructor() {
        this.apiConfig = {
            baseUrl: process.env.LICENSE_API_URL || 'https://fastwebstories.com.br/apibot/license_api.php',
            apiKey: process.env.LICENSE_API_KEY || 'SUA_CHAVE_SECRETA_SUPER_FORTE_2024',
            timeout: 10000
        };

        this.currentLicense = null;
        this.isValidated = false;
        this.lastApiCheck = null;
        this.validationInProgress = false;
        
        // ⭐ CONFIGURAÇÕES CONSERVADORAS
        this.useLocalFile = true;
        this.realTimeInterval = 300; // ⭐ AUMENTADO: Verificar API a cada 5 minutos (antes era 60s)
        this.forceApiCheck = false;
        this.maxApiFailures = 3; // ⭐ NOVO: Máximo de falhas antes de remover arquivo
        this.currentApiFailures = 0; // ⭐ CONTADOR de falhas consecutivas
        this.lastSuccessfulCheck = Date.now(); // ⭐ TIMESTAMP da última verificação bem-sucedida
        
        this.startPeriodicCheck();
    }

    /**
     * ⭐ VERIFICAÇÃO PERIÓDICA MAIS CONSERVADORA
     */
    startPeriodicCheck() {
        setInterval(async () => {
            if (this.currentLicense?.key && !this.validationInProgress) {
                try {
                    console.log('🔄 Verificação conservadora em tempo real...');
                    await this.validateLicense(this.currentLicense.key);
                } catch (error) {
                    console.error('❌ Erro na verificação automática:', error);
                    // ⭐ NÃO REMOVER ARQUIVO EM CASO DE ERRO DE REDE
                    this.currentApiFailures++;
                    console.log(`⚠️ Falha ${this.currentApiFailures}/${this.maxApiFailures} na verificação automática`);
                }
            }
        }, this.realTimeInterval * 1000);
    }

    /**
     * ⭐ REQUISIÇÃO À API COM TIMEOUT MAIOR
     */
    async makeApiRequest(action, params = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(this.apiConfig.baseUrl);
            url.searchParams.append('action', action);
            
            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }
            
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiConfig.apiKey,
                    'User-Agent': 'WhatsApp-Bot-Client/3.2-Conservative',
                    'Accept': 'application/json'
                }
            };

            console.log(`🔍 Verificando licença na API: GET ${url.href}`);
            
            const req = httpModule.request(options, (res) => {
                let responseData = '';

                console.log(`📡 Status da resposta: ${res.statusCode}`);

                res.on('data', (chunk) => {
                    responseData += chunk;
                });

                res.on('end', () => {
                    console.log('📄 Resposta da API:', responseData);
                    
                    if (!responseData.trim()) {
                        reject(new Error('Resposta vazia da API'));
                        return;
                    }
                    
                    try {
                        const jsonResponse = JSON.parse(responseData);
                        resolve(jsonResponse);
                    } catch (parseError) {
                        console.error('❌ Erro ao fazer parse da resposta:', parseError);
                        reject(new Error('Resposta inválida da API: ' + parseError.message));
                    }
                });
            });

            req.on('error', (error) => {
                console.error('❌ Erro de conexão:', error);
                reject(new Error('Erro de conexão: ' + error.message));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout na conexão com a API'));
            });

            // ⭐ TIMEOUT MAIOR PARA EVITAR FALHAS DESNECESSÁRIAS
            req.setTimeout(this.apiConfig.timeout * 2); // 20 segundos
            req.end();
        });
    }

    /**
     * ⭐ VALIDAÇÃO CONSERVADORA (TOLERANTE A FALHAS)
     */
    async validateLicense(licenseKey) {
        if (this.validationInProgress) {
            console.log('⏳ Validação já em andamento...');
            return { valid: this.isValidated, license: this.currentLicense };
        }

        this.validationInProgress = true;

        try {
            console.log(`🔐 Validando licença: ${licenseKey.substring(0, 8)}****`);
            
            const response = await this.makeApiRequest('check', {
                license: licenseKey
            });

            this.lastApiCheck = new Date();

            if (response.success && response.data.valid) {
                const licenseData = response.data.license;
                const status = response.data.status || 'desconhecido';
                
                console.log(`📊 Status da licença: ${status}`);
                console.log(`📋 Dados recebidos:`, licenseData);
                
                // ⭐ VERIFICAÇÃO RIGOROSA DE STATUS (APENAS CASOS CLAROS)
                const clearlyInvalidStatuses = ['expirada', 'expired', 'suspended'];
                
                if (clearlyInvalidStatuses.includes(status.toLowerCase())) {
                    console.log(`⚠️ Status claramente inválido: ${status}`);
                    
                    // ⭐ SÓ REMOVER ARQUIVO EM CASOS MUITO CLAROS
                    this.currentLicense = null;
                    this.isValidated = false;
                    await this.removeLicenseLocally();
                    
                    return {
                        valid: false,
                        message: `Licença está ${status}. Entre em contato com o suporte.`,
                        status: status
                    };
                }

                // ⭐ PARA STATUS AMBÍGUOS (pendente, inativa), SER MAIS TOLERANTE
                if (status.toLowerCase() === 'pendente' || status.toLowerCase() === 'inativa') {
                    console.log(`⚠️ Status ambíguo: ${status} - mantendo arquivo local por segurança`);
                    
                    // ⭐ INCREMENTAR CONTADOR MAS NÃO REMOVER IMEDIATAMENTE
                    this.currentApiFailures++;
                    
                    if (this.currentApiFailures >= this.maxApiFailures) {
                        console.log(`❌ Muitas falhas consecutivas (${this.currentApiFailures}) - removendo arquivo`);
                        
                        this.currentLicense = null;
                        this.isValidated = false;
                        await this.removeLicenseLocally();
                        
                        return {
                            valid: false,
                            message: `Licença está ${status} após múltiplas verificações.`,
                            status: status
                        };
                    } else {
                        console.log(`⚠️ Falha ${this.currentApiFailures}/${this.maxApiFailures} - mantendo arquivo local`);
                        
                        // ⭐ MANTER LICENÇA LOCAL TEMPORARIAMENTE
                        return {
                            valid: true,
                            license: this.currentLicense || licenseData,
                            message: `Status ${status} - usando cache local temporariamente`
                        };
                    }
                }

                // ⭐ LICENÇA VÁLIDA - RESETAR CONTADOR DE FALHAS
                this.currentApiFailures = 0;
                this.lastSuccessfulCheck = Date.now();
                
                this.currentLicense = {
                    key: licenseKey,
                    ...licenseData,
                    apiStatus: status,
                    lastCheck: new Date().toISOString(),
                    verifiedAt: new Date().toISOString()
                };
                this.isValidated = true;

                // ⭐ SALVAR NO ARQUIVO PARA PERSISTÊNCIA
                await this.saveLicenseLocally(this.currentLicense);

                console.log('✅ Licença válida confirmada e salva!');
                return {
                    valid: true,
                    license: this.currentLicense,
                    message: response.data.message || 'Licença válida'
                };
                
            } else {
                console.log('❌ Licença inválida pela API');
                
                // ⭐ INCREMENTAR CONTADOR MAS SER CONSERVADOR
                this.currentApiFailures++;
                
                if (this.currentApiFailures >= this.maxApiFailures) {
                    console.log(`❌ Muitas respostas inválidas consecutivas - removendo arquivo`);
                    
                    this.currentLicense = null;
                    this.isValidated = false;
                    await this.removeLicenseLocally();
                } else {
                    console.log(`⚠️ Resposta inválida ${this.currentApiFailures}/${this.maxApiFailures} - mantendo arquivo local`);
                    
                    // ⭐ SE TEM LICENÇA LOCAL VÁLIDA, MANTER TEMPORARIAMENTE
                    const localLicense = await this.readLicenseFile();
                    if (localLicense && new Date() < new Date(localLicense.expires_at)) {
                        console.log('💾 Mantendo licença local válida por segurança');
                        
                        this.currentLicense = localLicense;
                        this.isValidated = true;
                        
                        return {
                            valid: true,
                            license: localLicense,
                            message: 'Usando licença local - API instável'
                        };
                    }
                }
                
                return {
                    valid: false,
                    message: response.message || response.data?.message || 'Licença inválida'
                };
            }

        } catch (error) {
            console.error('❌ Erro ao validar licença:', error);
            
            // ⭐ EM CASO DE ERRO DE REDE, SEMPRE MANTER LICENÇA LOCAL
            const localLicense = await this.readLicenseFile();
            if (localLicense && new Date() < new Date(localLicense.expires_at)) {
                console.log('🔄 Erro na API - usando licença local válida');
                
                this.currentLicense = localLicense;
                this.isValidated = true;
                
                // ⭐ INCREMENTAR CONTADOR MAS NÃO REMOVER POR ERRO DE REDE
                this.currentApiFailures++;
                console.log(`⚠️ Erro de rede ${this.currentApiFailures}/${this.maxApiFailures} - mantendo arquivo`);
                
                return {
                    valid: true,
                    license: localLicense,
                    message: 'Usando licença local (erro na API)'
                };
            }
            
            this.currentLicense = null;
            this.isValidated = false;
            
            return {
                valid: false,
                message: 'Erro ao conectar com o servidor de licenças: ' + error.message
            };
        } finally {
            this.validationInProgress = false;
        }
    }

    /**
     * ⭐ VERIFICAÇÃO INTELIGENTE E CONSERVADORA
     */
    async checkLocalLicense() {
        try {
            // ⭐ PRIMEIRO: VERIFICAR ARQUIVO LOCAL
            const localLicense = await this.readLicenseFile();
            
            if (!localLicense) {
                console.log('📭 Nenhuma licença local encontrada');
                return { valid: false, message: 'Nenhuma licença local encontrada' };
            }

            console.log(`📂 Licença local encontrada: ${localLicense.key?.substring(0, 8)}****`);

            // ⭐ VERIFICAR SE NÃO EXPIROU LOCALMENTE
            const now = new Date();
            const expiresAt = new Date(localLicense.expires_at);
            
            if (now > expiresAt) {
                console.log('⏰ Licença local expirada - removendo');
                await this.removeLicenseLocally();
                return { valid: false, message: 'Licença local expirada' };
            }

            // ⭐ VERIFICAR SE PRECISA CONSULTAR API (MAIS CONSERVADOR)
            const lastCheck = new Date(localLicense.lastCheck || 0);
            const minutesSinceCheck = (now - lastCheck) / (1000 * 60);
            
            // ⭐ SÓ VERIFICAR API SE:
            // 1. Forçado manualmente
            // 2. Nunca verificou
            // 3. Passou MUITO tempo (5 minutos ao invés de 1)
            const shouldCheckApi = this.forceApiCheck || 
                                  !localLicense.lastCheck || 
                                  minutesSinceCheck > (this.realTimeInterval / 60);

            if (shouldCheckApi) {
                console.log(`🔄 Verificação na API necessária (${Math.round(minutesSinceCheck)} min desde última verificação)`);
                
                const validation = await this.validateLicense(localLicense.key);
                
                // Resetar flag de força
                this.forceApiCheck = false;
                
                return validation;
            } else {
                console.log(`⚡ Usando cache local (${Math.round(minutesSinceCheck)} min atrás)`);
                
                // ⭐ USAR LICENÇA LOCAL SEM VERIFICAR API
                this.currentLicense = localLicense;
                this.isValidated = true;
                
                return { valid: true, license: localLicense };
            }

        } catch (error) {
            console.error('❌ Erro ao verificar licença local:', error);
            return { valid: false, message: 'Erro ao verificar licença local' };
        }
    }

    /**
     * ⭐ LER ARQUIVO DE LICENÇA
     */
    async readLicenseFile() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            const licenseFile = path.join(__dirname, '..', '..', '.license');

            const data = await fs.readFile(licenseFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return null;
        }
    }

    /**
     * ⭐ SALVAR LICENÇA LOCAL (ARQUIVO + MEMÓRIA)
     */
    async saveLicenseLocally(licenseData) {
        try {
            // ⭐ SALVAR EM MEMÓRIA
            this.currentLicense = {
                ...licenseData,
                lastCheck: new Date().toISOString(),
                savedAt: new Date().toISOString(),
                apiFailures: this.currentApiFailures // ⭐ SALVAR CONTADOR
            };

            // ⭐ SALVAR EM ARQUIVO
            const fs = require('fs').promises;
            const path = require('path');
            const licenseFile = path.join(__dirname, '..', '..', '.license');

            await fs.writeFile(licenseFile, JSON.stringify(this.currentLicense, null, 2));
            console.log('💾 Licença salva em memória e arquivo');
            return true;
        } catch (error) {
            console.error('❌ Erro ao salvar licença:', error);
            return false;
        }
    }

    /**
     * ⭐ REMOVER LICENÇA (APENAS EM CASOS EXTREMOS)
     */
    async removeLicenseLocally() {
        try {
            console.log('🗑️ Removendo licença após confirmação de invalidade...');
            
            // ⭐ LIMPAR MEMÓRIA
            this.currentLicense = null;
            this.isValidated = false;
            this.currentApiFailures = 0; // ⭐ RESETAR CONTADOR
            
            // ⭐ REMOVER ARQUIVO
            const fs = require('fs').promises;
            const path = require('path');
            const licenseFile = path.join(__dirname, '..', '..', '.license');

            try {
                await fs.unlink(licenseFile);
                console.log('🗑️ Arquivo .license removido após confirmação');
            } catch (e) {
                // Arquivo não existe, tudo bem
            }

            console.log('🧹 Licença removida completamente');
            return true;
        } catch (error) {
            console.error('❌ Erro ao remover licença:', error);
            return false;
        }
    }

    /**
     * ⭐ LIMPEZA COMPLETA (APENAS MANUAL)
     */
    async clearAllCache() {
        console.log('🧹 Limpando todos os caches manualmente...');
        
        this.currentLicense = null;
        this.isValidated = false;
        this.lastApiCheck = null;
        this.forceApiCheck = false;
        this.currentApiFailures = 0; // ⭐ RESETAR CONTADOR
        
        await this.removeLicenseLocally();
        
        console.log('✅ Cache limpo completamente');
    }

    /**
     * ⭐ FORÇAR VERIFICAÇÃO NA API (RESETAR CONTADOR)
     */
    forceApiValidation() {
        this.forceApiCheck = true;
        this.currentApiFailures = 0; // ⭐ RESETAR CONTADOR AO FORÇAR
        console.log('🔄 Forçando verificação na API...');
    }

    /**
     * Verifica se a licença está ativa
     */
    isLicenseValid() {
        return this.isValidated && this.currentLicense !== null;
    }

    /**
     * Obtém informações da licença atual
     */
    getCurrentLicense() {
        return this.currentLicense;
    }

    /**
     * Desativa licença
     */
    async deactivateLicense() {
        console.log('🔄 Desativando licença manualmente...');
        await this.clearAllCache();
        return true;
    }

    /**
     * Testa conexão com a API
     */
    async testApiConnection() {
        try {
            const response = await this.makeApiRequest('status');
            return response.success;
        } catch (error) {
            console.error('❌ Erro ao testar API:', error);
            return false;
        }
    }

    /**
     * ⭐ MIDDLEWARE COM VERIFICAÇÃO CONSERVADORA
     */
    requireValidLicense() {
        return async (req, res, next) => {
            try {
                console.log('🔐 Verificação conservadora de licença para rota:', req.path);
                
                const licenseCheck = await this.checkLocalLicense();
                
                if (!licenseCheck.valid) {
                    console.log('❌ Acesso negado para rota:', req.path);
                    return res.status(401).json({
                        success: false,
                        message: licenseCheck.message || 'Licença inválida ou expirada',
                        requireLicense: true,
                        timestamp: new Date().toISOString()
                    });
                }
                
                console.log('✅ Acesso autorizado para rota:', req.path);
                next();
                
            } catch (error) {
                console.error('❌ Erro na verificação de licença:', error);
                return res.status(500).json({
                    success: false,
                    message: 'Erro interno na verificação de licença',
                    requireLicense: true
                });
            }
        };
    }

    /**
     * Obtém estatísticas da API
     */
    async getApiStatus() {
        try {
            const response = await this.makeApiRequest('status');
            return response.success ? response.data : null;
        } catch (error) {
            console.error('❌ Erro ao obter status da API:', error);
            return null;
        }
    }

    /**
     * Verifica status atual
     */
    async checkCurrentStatus() {
        if (!this.currentLicense?.key) {
            return { 
                valid: false, 
                message: 'Nenhuma licença carregada' 
            };
        }

        console.log('🔄 Verificando status atual na API...');
        return await this.validateLicense(this.currentLicense.key);
    }

    /**
     * Obter ID da máquina
     */
    getMachineId() {
        const os = require('os');
        const crypto = require('crypto');
        
        const machineData = [
            os.hostname(),
            os.platform(),
            os.arch(),
            os.userInfo().username
        ].join('|');
        
        return crypto.createHash('md5').update(machineData).digest('hex');
    }

    /**
     * Fechar conexões
     */
    async close() {
        console.log('🔌 Limpando serviço de licenças...');
        this.currentLicense = null;
        this.isValidated = false;
        this.lastApiCheck = null;
    }
}

module.exports = new LicenseService();