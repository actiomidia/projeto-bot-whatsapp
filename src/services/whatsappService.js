const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

class WhatsAppService {
    constructor() {
        this.client = null;
        this.io = null;
        this.isReady = false;
        this.qrCode = null;
    }

    initialize(io) {
        this.io = io;
        this.createClient();
    }

    createClient() {
        console.log('Inicializando cliente WhatsApp...');
        
        this.client = new Client({
            authStrategy: new LocalAuth({
                clientId: "whatsapp-bot-session",
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--single-process',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--disable-features=IsolateOrigins,site-per-process'
                ]
            },
            qrMaxRetries: 5
        });

        this.setupEventHandlers();
        
        console.log('Inicializando WhatsApp Web...');
        this.client.initialize().catch(err => {
            console.error('Erro ao inicializar cliente:', err);
            this.io.emit('message', '❌ Erro ao inicializar WhatsApp: ' + err.message);
        });
    }

    setupEventHandlers() {
        // QR Code
        this.client.on('qr', async (qr) => {
            console.log('QR Code recebido:', qr.substring(0, 50) + '...');
            this.qrCode = qr;
            
            try {
                const qrCodeDataURL = await qrcode.toDataURL(qr);
                console.log('QR Code convertido para imagem');
                this.io.emit('qr', qrCodeDataURL);
                this.io.emit('message', 'QR Code gerado. Escaneie com seu WhatsApp!');
            } catch (err) {
                console.error('Erro ao gerar QR Code:', err);
                this.io.emit('message', 'Erro ao gerar QR Code: ' + err.message);
            }
        });

        // Loading screen
        this.client.on('loading_screen', (percent, message) => {
            console.log('Carregando:', percent, message);
            this.io.emit('loading_screen', { percent, message });
            this.io.emit('message', `Carregando WhatsApp: ${percent}% - ${message}`);
        });

        // Cliente pronto
        this.client.on('ready', () => {
            console.log('Cliente WhatsApp está pronto!');
            this.isReady = true;
            this.qrCode = null;
            this.io.emit('ready', true);
            this.io.emit('message', '✅ WhatsApp conectado com sucesso!');
            this.io.emit('qr', null); // Limpar QR Code
        });

        // Autenticado
        this.client.on('authenticated', () => {
            console.log('WhatsApp autenticado!');
            this.io.emit('authenticated', true);
            this.io.emit('message', '🔐 Autenticação realizada com sucesso!');
        });

        // Falha na autenticação
        this.client.on('auth_failure', (msg) => {
            console.error('Falha na autenticação:', msg);
            this.isReady = false;
            this.io.emit('auth_failure', msg);
            this.io.emit('message', '❌ Falha na autenticação. Tente novamente.');
        });

        // Desconectado
        this.client.on('disconnected', (reason) => {
            console.log('Cliente desconectado:', reason);
            this.isReady = false;
            this.io.emit('disconnected', reason);
            this.io.emit('message', '📵 WhatsApp desconectado. Recarregue a página.');
            
            // Tentar reconectar
            setTimeout(() => {
                this.client.initialize();
            }, 5000);
        });

        // Mensagem recebida
        this.client.on('message', async (message) => {
            console.log('Mensagem recebida:', message.from, message.body);
            this.io.emit('incoming-message', {
                from: message.from,
                body: message.body,
                timestamp: message.timestamp
            });
        });

        // Mudança de estado
        this.client.on('change_state', (state) => {
            console.log('Estado mudou:', state);
            this.io.emit('change_state', state);
            this.io.emit('message', `Estado: ${state}`);
        });

        // Erro no cliente
        this.client.on('error', (error) => {
            console.error('Erro no cliente WhatsApp:', error);
            this.io.emit('message', '❌ Erro: ' + error.message);
        });
    }

    async sendMessage(number, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            // Formatar número (remover caracteres não numéricos)
            let formattedNumber = number.replace(/\D/g, '');
            
            // Adicionar código do país se não tiver
            if (!formattedNumber.startsWith('55')) {
                formattedNumber = '55' + formattedNumber;
            }
            
            // Adicionar @c.us
            const chatId = formattedNumber + '@c.us';
            
            console.log('Enviando mensagem para:', chatId);
            
            // Verificar se o número existe no WhatsApp
            const isRegistered = await this.client.isRegisteredUser(chatId);
            
            if (!isRegistered) {
                throw new Error('Número não está registrado no WhatsApp');
            }
            
            // Enviar mensagem
            const result = await this.client.sendMessage(chatId, message);
            
            console.log('Mensagem enviada com sucesso!');
            
            return {
                success: true,
                message: 'Mensagem enviada com sucesso!',
                to: number,
                messageId: result.id
            };
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            throw error;
        }
    }

    async sendBulkMessages(numbers, message, options = {}) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        const { delay = 3000, stopOnError = false } = options;
        const results = [];
        const total = numbers.length;
        let sent = 0;
        let failed = 0;

        console.log(`Iniciando envio em massa para ${total} números`);

        for (let i = 0; i < numbers.length; i++) {
            const number = numbers[i];
            
            try {
                // Emitir progresso
                this.io.emit('bulk-progress', {
                    total,
                    current: i + 1,
                    sent,
                    failed,
                    percentage: Math.round(((i + 1) / total) * 100)
                });

                // Enviar mensagem
                const result = await this.sendMessage(number, message);
                sent++;
                
                results.push({
                    number,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date()
                });

                this.io.emit('bulk-message-sent', {
                    number,
                    index: i + 1,
                    total
                });

                // Delay entre mensagens (evitar banimento)
                if (i < numbers.length - 1) {
                    await this.sleep(delay);
                }

            } catch (error) {
                failed++;
                console.error(`Erro ao enviar para ${number}:`, error.message);
                
                results.push({
                    number,
                    success: false,
                    error: error.message,
                    timestamp: new Date()
                });

                this.io.emit('bulk-message-failed', {
                    number,
                    error: error.message,
                    index: i + 1,
                    total
                });

                if (stopOnError) {
                    console.log('Parando envio em massa devido a erro');
                    break;
                }
            }
        }

        const summary = {
            total,
            sent,
            failed,
            results,
            startTime: results[0]?.timestamp,
            endTime: results[results.length - 1]?.timestamp
        };

        this.io.emit('bulk-complete', summary);
        console.log(`Envio em massa concluído: ${sent} enviados, ${failed} falharam`);

        return summary;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getConnectionStatus() {
        return {
            isReady: this.isReady,
            hasQR: !!this.qrCode
        };
    }

    getCurrentQR() {
        return this.qrCode;
    }

    requestNewQR() {
        if (!this.isReady && this.client) {
            console.log('Solicitando novo QR Code...');
            this.client.initialize();
        }
    }

    async logout() {
        if (this.client) {
            try {
                await this.client.logout();
                this.isReady = false;
                this.io.emit('message', 'Logout realizado com sucesso');
            } catch (error) {
                console.error('Erro ao fazer logout:', error);
            }
        }
    }

    async getGroups() {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            const chats = await this.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            return groups.map(group => ({
                id: group.id._serialized,
                name: group.name,
                participantsCount: group.participants.length,
                description: group.description || 'Sem descrição',
                isReadOnly: group.isReadOnly,
                isMuted: group.isMuted,
                createdAt: group.createdAt
            }));
        } catch (error) {
            console.error('Erro ao buscar grupos:', error);
            throw error;
        }
    }

    async sendMessageToGroup(groupId, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            console.log('Enviando mensagem para grupo:', groupId);
            
            // Verificar se o chat existe
            const chat = await this.client.getChatById(groupId);
            
            if (!chat) {
                throw new Error('Grupo não encontrado');
            }
            
            if (!chat.isGroup) {
                throw new Error('O ID fornecido não é de um grupo');
            }
            
            // Enviar mensagem
            const result = await chat.sendMessage(message);
            
            console.log('Mensagem enviada para o grupo com sucesso!');
            
            return {
                success: true,
                message: 'Mensagem enviada para o grupo com sucesso!',
                groupName: chat.name,
                messageId: result.id
            };
        } catch (error) {
            console.error('Erro ao enviar mensagem para grupo:', error);
            throw error;
        }
    }

    async sendToMultipleGroups(groupIds, message, options = {}) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        const { delay = 3000, stopOnError = false } = options;
        const results = [];
        const total = groupIds.length;
        let sent = 0;
        let failed = 0;

        console.log(`Iniciando envio para ${total} grupos`);

        for (let i = 0; i < groupIds.length; i++) {
            const groupId = groupIds[i];
            
            try {
                this.io.emit('group-bulk-progress', {
                    total,
                    current: i + 1,
                    sent,
                    failed,
                    percentage: Math.round(((i + 1) / total) * 100)
                });

                const result = await this.sendMessageToGroup(groupId, message);
                sent++;
                
                results.push({
                    groupId,
                    groupName: result.groupName,
                    success: true,
                    messageId: result.messageId,
                    timestamp: new Date()
                });

                this.io.emit('group-message-sent', {
                    groupId,
                    groupName: result.groupName,
                    index: i + 1,
                    total
                });

                if (i < groupIds.length - 1) {
                    await this.sleep(delay);
                }

            } catch (error) {
                failed++;
                console.error(`Erro ao enviar para grupo ${groupId}:`, error.message);
                
                results.push({
                    groupId,
                    success: false,
                    error: error.message,
                    timestamp: new Date()
                });

                this.io.emit('group-message-failed', {
                    groupId,
                    error: error.message,
                    index: i + 1,
                    total
                });

                if (stopOnError) {
                    console.log('Parando envio devido a erro');
                    break;
                }
            }
        }

        const summary = {
            total,
            sent,
            failed,
            results,
            startTime: results[0]?.timestamp,
            endTime: results[results.length - 1]?.timestamp
        };

        this.io.emit('group-bulk-complete', summary);
        console.log(`Envio para grupos concluído: ${sent} enviados, ${failed} falharam`);

        return summary;
    }

    async getGroupInfo(groupId) {
        if (!this.isReady) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            const chat = await this.client.getChatById(groupId);
            
            if (!chat.isGroup) {
                throw new Error('O ID fornecido não é de um grupo');
            }
            
            const participants = chat.participants.map(p => ({
                id: p.id._serialized,
                isAdmin: p.isAdmin,
                isSuperAdmin: p.isSuperAdmin
            }));
            
            return {
                id: chat.id._serialized,
                name: chat.name,
                description: chat.description,
                participants: participants,
                participantsCount: participants.length,
                createdAt: chat.createdAt,
                owner: chat.owner,
                isReadOnly: chat.isReadOnly
            };
        } catch (error) {
            console.error('Erro ao buscar informações do grupo:', error);
            throw error;
        }
    }
}

module.exports = new WhatsAppService();