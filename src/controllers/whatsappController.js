const whatsappService = require('../services/whatsappService');

class WhatsAppController {
    async sendMessage(req, res) {
        try {
            console.log('📨 Controller: sendMessage chamado');
            const { number, message } = req.body;

            if (!number || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Número e mensagem são obrigatórios'
                });
            }

            const result = await whatsappService.sendMessage(number, message);
            res.json(result);
        } catch (error) {
            console.error('❌ Erro no controller sendMessage:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sendBulkMessages(req, res) {
        try {
            console.log('📊 Controller: sendBulkMessages chamado');
            const { numbers, message, delay, stopOnError } = req.body;

            if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Lista de números é obrigatória'
                });
            }

            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensagem é obrigatória'
                });
            }

            // Limitar quantidade de números por vez
            if (numbers.length > 100) {
                return res.status(400).json({
                    success: false,
                    error: 'Máximo de 100 números por vez'
                });
            }

            // Iniciar envio em massa (não aguardar conclusão)
            whatsappService.sendBulkMessages(numbers, message, {
                delay: delay || 3000,
                stopOnError: stopOnError || false
            });

            res.json({
                success: true,
                message: 'Envio em massa iniciado',
                total: numbers.length
            });
        } catch (error) {
            console.error('❌ Erro no controller sendBulkMessages:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getStatus(req, res) {
        try {
            console.log('📊 Controller: getStatus chamado');
            const status = whatsappService.getConnectionStatus();
            res.json({
                success: true,
                ...status
            });
        } catch (error) {
            console.error('❌ Erro no controller getStatus:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async logout(req, res) {
        try {
            console.log('🚪 Controller: logout chamado');
            await whatsappService.logout();
            res.json({
                success: true,
                message: 'Logout realizado com sucesso'
            });
        } catch (error) {
            console.error('❌ Erro no controller logout:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getInfo(req, res) {
        try {
            console.log('ℹ️ Controller: getInfo chamado');
            const info = await whatsappService.getInfo();
            res.json({
                success: true,
                info
            });
        } catch (error) {
            console.error('❌ Erro no controller getInfo:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getGroups(req, res) {
        try {
            console.log('👥 Controller: getGroups chamado');
            console.log('🔍 Headers recebidos:', req.headers);
            console.log('🔍 Método:', req.method);
            console.log('🔍 URL:', req.url);
            
            // ⭐ VERIFICAR SE O WHATSAPP ESTÁ CONECTADO
            if (!whatsappService.isReady) {
                console.log('❌ WhatsApp não está conectado');
                return res.status(400).json({
                    success: false,
                    error: 'WhatsApp não está conectado'
                });
            }

            console.log('✅ WhatsApp está conectado - buscando grupos...');
            const groups = await whatsappService.getGroups();
            
            console.log(`✅ Grupos encontrados: ${groups.length}`);
            
            res.json({
                success: true,
                groups,
                count: groups.length
            });
        } catch (error) {
            console.error('❌ Erro no controller getGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sendToGroup(req, res) {
        try {
            console.log('👥 Controller: sendToGroup chamado');
            const { groupId, message } = req.body;

            if (!groupId || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'ID do grupo e mensagem são obrigatórios'
                });
            }

            const result = await whatsappService.sendMessageToGroup(groupId, message);
            res.json(result);
        } catch (error) {
            console.error('❌ Erro no controller sendToGroup:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async sendToMultipleGroups(req, res) {
        try {
            console.log('👥 Controller: sendToMultipleGroups chamado');
            const { groupIds, message, delay, stopOnError } = req.body;

            if (!groupIds || !Array.isArray(groupIds) || groupIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Lista de IDs de grupos é obrigatória'
                });
            }

            if (!message) {
                return res.status(400).json({
                    success: false,
                    error: 'Mensagem é obrigatória'
                });
            }

            // Limitar quantidade de grupos por vez
            if (groupIds.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Máximo de 50 grupos por vez'
                });
            }

            // Iniciar envio para grupos (não aguardar conclusão)
            whatsappService.sendToMultipleGroups(groupIds, message, {
                delay: delay || 3000,
                stopOnError: stopOnError || false
            });

            res.json({
                success: true,
                message: 'Envio para grupos iniciado',
                total: groupIds.length
            });
        } catch (error) {
            console.error('❌ Erro no controller sendToMultipleGroups:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }

    async getGroupInfo(req, res) {
        try {
            console.log('👥 Controller: getGroupInfo chamado');
            const { groupId } = req.params;

            if (!groupId) {
                return res.status(400).json({
                    success: false,
                    error: 'ID do grupo é obrigatório'
                });
            }

            const info = await whatsappService.getGroupInfo(groupId);
            res.json({
                success: true,
                info
            });
        } catch (error) {
            console.error('❌ Erro no controller getGroupInfo:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
}

module.exports = new WhatsAppController();