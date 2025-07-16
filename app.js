require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const qrcode = require('qrcode');

// Importar serviços e rotas
const whatsappService = require('./src/services/whatsappService');
const licenseService = require('./src/services/licenseService');
const routes = require('./src/routes/routes');

// Criar aplicação Express
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Debug middleware
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// ⭐ MIDDLEWARE SIMPLES - SÓ PARA PÁGINA INICIAL
app.use(async (req, res, next) => {
    // ⭐ ROTAS QUE NÃO PRECISAM DE VERIFICAÇÃO
    const freeRoutes = [
        '/api/', // TODAS as rotas da API são livres
        '/css/',
        '/js/',
        '/socket.io/',
        '/favicon.ico'
    ];

    const isFreeRoute = freeRoutes.some(route => req.path.startsWith(route));

    // ⭐ SE FOR ROTA LIVRE, PASSAR DIRETO
    if (isFreeRoute) {
        return next();
    }

    // ⭐ SÓ VERIFICAR LICENÇA PARA A PÁGINA INICIAL (/)
    if (req.path === '/') {
        try {
            const middlewareLicenseCheck = await licenseService.checkLocalLicense();
            
            if (!middlewareLicenseCheck.valid) {
                return res.redirect('/?license_required=true');
            }
        } catch (error) {
            console.log('⚠️ Erro na verificação inicial - continuando mesmo assim');
        }
    }

    next();
});

// Rotas da API
app.use('/api', routes);

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ⭐ INICIALIZAR WHATSAPP APENAS SE LICENÇA FOR VÁLIDA
async function initializeWhatsAppIfLicensed() {
    try {
        console.log('🔍 Verificando licença para inicializar WhatsApp...');
        const initLicenseCheck = await licenseService.checkLocalLicense();
        
        if (initLicenseCheck.valid) {
            console.log('✅ Licença válida - Inicializando WhatsApp Service');
            whatsappService.initialize(io);
        } else {
            console.log('❌ Licença inválida - WhatsApp Service não inicializado');
            console.log('📋 Motivo:', initLicenseCheck.message);
        }
    } catch (error) {
        console.error('❌ Erro ao verificar licença inicial:', error);
    }
}

// Socket.IO - Conexões
io.on('connection', async (socket) => {
    console.log('Cliente conectado:', socket.id);

    // ⭐ VERIFICAÇÃO INICIAL SIMPLES
    try {
        const socketLicenseCheck = await licenseService.checkLocalLicense();
        
        if (!socketLicenseCheck.valid) {
            console.log('❌ Licença inválida para socket:', socket.id);
            socket.emit('license-required', {
                message: socketLicenseCheck.message || 'Licença inválida ou expirada',
                requireLicense: true
            });
            return;
        }

        // ⭐ ENVIAR STATUS DA LICENÇA
        socket.emit('license-status', {
            valid: true,
            license: socketLicenseCheck.license
        });

        console.log('✅ Licença válida para socket:', socket.id);

        // ⭐ VERIFICAR STATUS DO WHATSAPP
        const connectionStatus = whatsappService.getConnectionStatus();
        const currentQR = whatsappService.getCurrentQR();
        
        if (whatsappService.isReady) {
            console.log('📱 WhatsApp já pronto - informando cliente');
            socket.emit('ready', true);
            socket.emit('message', '✅ WhatsApp conectado com sucesso!');
            socket.emit('qr', null);
        } else if (currentQR) {
            console.log('📱 QR Code disponível - enviando para cliente');
            try {
                const qrDataURL = await qrcode.toDataURL(currentQR);
                socket.emit('qr', qrDataURL);
                socket.emit('message', 'QR Code disponível. Escaneie com seu WhatsApp!');
            } catch (err) {
                console.error('Erro ao converter QR:', err);
                socket.emit('message', 'Erro ao gerar QR Code');
            }
        } else {
            console.log('📱 WhatsApp não iniciado - inicializando...');
            
            if (!whatsappService.client) {
                console.log('🚀 Inicializando WhatsApp Service para cliente');
                socket.emit('message', 'Inicializando WhatsApp...');
                whatsappService.initialize(io);
            } else {
                socket.emit('message', 'Aguardando conexão do WhatsApp...');
            }
        }
        
    } catch (error) {
        console.error('❌ Erro na verificação de licença do socket:', error);
        socket.emit('license-required', {
            message: 'Erro ao verificar licença',
            requireLicense: true
        });
    }

    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });

    // ⭐ VALIDAR LICENÇA VIA SOCKET
    socket.on('validate-license', async (data) => {
        try {
            const { licenseKey } = data;
            console.log(`🔐 Validação via socket: ${licenseKey?.substring(0, 8)}****`);
            
            const validation = await licenseService.validateLicense(licenseKey);

            if (validation.valid) {
                await licenseService.saveLicenseLocally(validation.license);
                
                socket.emit('license-validated', {
                    success: true,
                    message: 'Licença validada com sucesso!',
                    license: validation.license
                });

                console.log('✅ Licença validada via socket - Inicializando WhatsApp...');
                
                setTimeout(() => {
                    if (!whatsappService.client || !whatsappService.isReady) {
                        whatsappService.initialize(io);
                    } else {
                        socket.emit('ready', true);
                        socket.emit('message', '✅ WhatsApp já conectado!');
                    }
                }, 1000);

            } else {
                socket.emit('license-validation-failed', {
                    success: false,
                    message: validation.message
                });
            }

        } catch (error) {
            console.error('❌ Erro na validação via socket:', error);
            socket.emit('license-validation-failed', {
                success: false,
                message: 'Erro ao validar licença: ' + error.message
            });
        }
    });

    // ⭐ EVENTOS SEM VERIFICAÇÃO DE LICENÇA
    socket.on('send-message', async (data) => {
        try {
            const { number, message } = data;
            const result = await whatsappService.sendMessage(number, message);
            socket.emit('message-status', result);
        } catch (error) {
            socket.emit('message-status', { 
                success: false, 
                error: error.message 
            });
        }
    });

    socket.on('send-bulk', async (data) => {
        try {
            const { numbers, message, delay, stopOnError } = data;
            whatsappService.sendBulkMessages(numbers, message, {
                delay: delay || 3000,
                stopOnError: stopOnError || false
            });
        } catch (error) {
            socket.emit('bulk-error', { 
                error: error.message 
            });
        }
    });

    socket.on('send-to-groups', async (data) => {
        try {
            const { groupIds, message, delay, stopOnError } = data;
            whatsappService.sendToMultipleGroups(groupIds, message, {
                delay: delay || 3000,
                stopOnError: stopOnError || false
            });
        } catch (error) {
            socket.emit('group-error', { 
                error: error.message 
            });
        }
    });

    socket.on('request-qr', async () => {
        try {
            console.log('📱 Cliente solicitou novo QR Code');
            socket.emit('message', 'Gerando novo QR Code...');
            
            if (!whatsappService.client || !whatsappService.isReady) {
                whatsappService.initialize(io);
            } else {
                whatsappService.requestNewQR();
            }
        } catch (error) {
            console.error('❌ Erro ao solicitar QR:', error);
            socket.emit('message', 'Erro ao gerar QR Code');
        }
    });

    socket.on('check-status', async () => {
        try {
            const status = whatsappService.getConnectionStatus();
            const currentQR = whatsappService.getCurrentQR();
            
            console.log('📊 Status solicitado:', status);
            
            socket.emit('connection-status', status);
            
            if (currentQR && !whatsappService.isReady) {
                try {
                    const qrDataURL = await qrcode.toDataURL(currentQR);
                    socket.emit('qr', qrDataURL);
                    socket.emit('message', 'QR Code disponível');
                } catch (err) {
                    console.error('Erro ao converter QR:', err);
                }
            }
            
            if (whatsappService.isReady) {
                socket.emit('ready', true);
                socket.emit('qr', null);
                socket.emit('message', '✅ WhatsApp conectado e pronto!');
            }
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            socket.emit('message', 'Erro ao verificar status');
        }
    });
});

// ⭐ VERIFICAR E INICIALIZAR WHATSAPP SE LICENÇA VÁLIDA
initializeWhatsAppIfLicensed();

// Porta do servidor
const PORT = process.env.PORT || 3000;

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🔄 Fechando conexões...');
    await licenseService.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('🔄 Fechando conexões...');
    await licenseService.close();
    process.exit(0);
});

// Iniciar servidor
server.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse: http://localhost:${PORT}`);
    console.log(`🔐 Sistema de licenças simples (só no acesso)`);
    console.log(`========================================\n`);
});