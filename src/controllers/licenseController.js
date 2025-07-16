const licenseService = require('../services/licenseService');

class LicenseController {
    
    /**
     * ⭐ VERIFICA STATUS EM TEMPO REAL - SEM CACHE
     */
    async checkLicenseStatus(req, res) {
        try {
            console.log('🔍 Verificando status da licença em tempo real...');
            
            const realTimeCheck = await licenseService.checkLocalLicense();
            
            res.json({
                success: true,
                isValid: realTimeCheck.valid,
                license: realTimeCheck.license || null,
                message: realTimeCheck.message,
                timestamp: new Date().toISOString(),
                mode: 'real-time' // ⭐ Indicar que é tempo real
            });

        } catch (error) {
            console.error('Erro ao verificar status:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao verificar status da licença',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }

    /**
     * ⭐ FORÇA VERIFICAÇÃO NA API (REDUNDANTE - JÁ É SEMPRE TEMPO REAL)
     */
    async forceCheckLicense(req, res) {
        try {
            console.log('🔄 Forçando verificação na API (modo tempo real)...');
            
            // Limpar qualquer cache residual
            licenseService.forceApiValidation();
            
            const apiCheck = await licenseService.checkLocalLicense();
            
            res.json({
                success: true,
                message: 'Verificação em tempo real concluída',
                isValid: apiCheck.valid,
                license: apiCheck.license || null,
                timestamp: new Date().toISOString(),
                mode: 'forced-real-time'
            });

        } catch (error) {
            console.error('Erro na verificação forçada:', error);
            res.status(500).json({
                success: false,
                message: 'Erro na verificação forçada',
                error: error.message
            });
        }
    }

    /**
     * ⭐ LIMPA CACHE (MEMÓRIA) 
     */
    async clearCache(req, res) {
        try {
            console.log('🧹 Limpando cache por requisição...');
            
            await licenseService.clearAllCache();
            
            res.json({
                success: true,
                message: 'Cache limpo - sistema em modo tempo real',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao limpar cache',
                error: error.message
            });
        }
    }

    /**
     * ⭐ DEBUG SIMPLIFICADO - SEM ARQUIVO LOCAL
     */
    async debugLicense(req, res) {
        try {
            // Status atual do serviço
            const currentLicense = licenseService.getCurrentLicense();
            const isValid = licenseService.isLicenseValid();

            // Testar API
            let apiTest = null;
            try {
                apiTest = await licenseService.testApiConnection();
            } catch (e) {
                apiTest = false;
            }

            // Se tem licença, testar diretamente na API
            let directApiCheck = null;
            if (currentLicense?.key) {
                try {
                    directApiCheck = await licenseService.checkCurrentStatus();
                } catch (e) {
                    directApiCheck = { error: e.message };
                }
            }

            res.json({
                success: true,
                debug: {
                    mode: 'real-time-only',
                    service_status: {
                        is_validated: isValid,
                        has_current_license: !!currentLicense,
                        memory_only: true
                    },
                    local_file: {
                        exists: false,
                        note: 'Sistema não usa arquivo local - apenas API em tempo real'
                    },
                    memory_cache: currentLicense ? {
                        key: currentLicense.key?.substring(0, 8) + '****',
                        expires_at: currentLicense.expires_at,
                        api_status: currentLicense.apiStatus,
                        last_check: currentLicense.lastCheck,
                        verified_at: currentLicense.verifiedAt,
                        memory_only: currentLicense.memoryOnly
                    } : null,
                    api_connection: apiTest,
                    direct_api_check: directApiCheck
                },
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro no debug:', error);
            res.status(500).json({
                success: false,
                message: 'Erro no debug',
                error: error.message
            });
        }
    }

    /**
     * ⭐ VALIDA LICENÇA EM TEMPO REAL
     */
    async validateLicense(req, res) {
        try {
            const { licenseKey } = req.body;

            if (!licenseKey || licenseKey.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Chave de licença é obrigatória'
                });
            }

            console.log(`🔐 Validando licença: ${licenseKey.substring(0, 8)}****`);
            
            // ⭐ LIMPAR QUALQUER CACHE ANTES DE VALIDAR
            await licenseService.clearAllCache();
            
            // ⭐ VALIDAR DIRETAMENTE NA API
            const validation = await licenseService.validateLicense(licenseKey.trim());

            if (validation.valid) {
                // ⭐ SALVAR APENAS EM MEMÓRIA
                const saved = await licenseService.saveLicenseLocally(validation.license);
                
                if (saved) {
                    res.json({
                        success: true,
                        message: 'Licença validada com sucesso!',
                        license: validation.license,
                        mode: 'real-time',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        message: 'Licença válida, mas erro ao salvar em memória'
                    });
                }
            } else {
                res.status(400).json({
                    success: false,
                    message: validation.message,
                    status: validation.status,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('Erro na validação da licença:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor',
                error: error.message
            });
        }
    }

    /**
     * ⭐ REMOVE LICENÇA (MEMÓRIA E ARQUIVO)
     */
    async deactivateLicense(req, res) {
        try {
            console.log('🔄 Desativando licença...');
            
            const result = await licenseService.deactivateLicense();
            
            if (result) {
                res.json({
                    success: true,
                    message: 'Licença desativada com sucesso',
                    mode: 'real-time',
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Erro ao desativar licença'
                });
            }

        } catch (error) {
            console.error('Erro ao desativar licença:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao desativar licença',
                error: error.message
            });
        }
    }

    /**
     * ⭐ INFORMAÇÕES EM TEMPO REAL
     */
    async getLicenseInfo(req, res) {
        try {
            // ⭐ VERIFICAR EM TEMPO REAL
            const currentCheck = await licenseService.checkLocalLicense();
            
            if (!currentCheck.valid) {
                return res.status(401).json({
                    success: false,
                    message: currentCheck.message || 'Nenhuma licença ativa',
                    requireLicense: true
                });
            }

            const license = currentCheck.license;
            
            res.json({
                success: true,
                license: {
                    key: license.key ? license.key.substring(0, 8) + '****' : 'N/A',
                    expires_at: license.expires_at,
                    expires_formatted: license.expires_formatted,
                    days_remaining: license.days_remaining,
                    is_active: license.is_active,
                    api_status: license.apiStatus || license.final_status,
                    notes: license.notes || '',
                    verified_at: license.verifiedAt,
                    last_check: license.lastCheck,
                    memory_only: license.memoryOnly,
                    customer_name: license.customer_name,
                    license_type: license.license_type,
                    max_uses: license.max_uses,
                    current_uses: license.current_uses,
                    usage_remaining: license.usage_remaining
                },
                mode: 'real-time',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro ao obter informações:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter informações da licença',
                error: error.message
            });
        }
    }

    /**
     * ⭐ RENOVAÇÃO EM TEMPO REAL
     */
    async renewLicense(req, res) {
        try {
            const currentCheck = await licenseService.checkLocalLicense();
            
            if (!currentCheck.valid) {
                return res.status(401).json({
                    success: false,
                    message: 'Nenhuma licença ativa para renovar'
                });
            }

            const currentLicense = licenseService.getCurrentLicense();
            
            if (!currentLicense?.key) {
                return res.status(400).json({
                    success: false,
                    message: 'Chave de licença não encontrada'
                });
            }
            
            // ⭐ FORÇAR VERIFICAÇÃO NA API
            licenseService.forceApiValidation();
            
            // ⭐ VALIDAR NOVAMENTE NA API
            const validation = await licenseService.validateLicense(currentLicense.key);
            
            if (validation.valid) {
                await licenseService.saveLicenseLocally(validation.license);
                
                res.json({
                    success: true,
                    message: 'Licença renovada com sucesso',
                    license: validation.license,
                    mode: 'real-time',
                    timestamp: new Date().toISOString()
                });
            } else {
                await licenseService.removeLicenseLocally();
                
                res.status(400).json({
                    success: false,
                    message: validation.message,
                    requireNewLicense: true,
                    timestamp: new Date().toISOString()
                });
            }

        } catch (error) {
            console.error('Erro ao renovar licença:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao renovar licença',
                error: error.message
            });
        }
    }

    /**
     * ⭐ DOWNLOAD PROTEGIDO COM VERIFICAÇÃO EM TEMPO REAL
     */
    async downloadFiles(req, res) {
        try {
            // ⭐ VERIFICAR LICENÇA EM TEMPO REAL
            const realTimeCheck = await licenseService.checkLocalLicense();
            
            if (!realTimeCheck.valid) {
                return res.status(401).json({
                    success: false,
                    message: 'Licença inválida. Acesso negado ao download.',
                    requireLicense: true
                });
            }

            const archiver = require('archiver');
            const path = require('path');
            const fs = require('fs');

            // Configurar resposta para download
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=whatsapp-bot.zip');

            // Criar arquivo ZIP
            const archive = archiver('zip', {
                zlib: { level: 9 }
            });

            // Pipe do arquivo para a resposta
            archive.pipe(res);

            // Adicionar arquivos ao ZIP (excluindo arquivos sensíveis)
            const projectRoot = path.join(__dirname, '..', '..');
            
            const filesToInclude = [
                'app.js',
                'package.json',
                'src/',
                'public/',
                '.env.example'
            ];

            const filesToExclude = [
                'node_modules',
                '.git',
                '.license', // ⭐ Garantir que arquivo .license não seja incluído
                '.wwebjs_auth',
                '.env',
                'logs'
            ];

            for (const file of filesToInclude) {
                const fullPath = path.join(projectRoot, file);
                
                if (fs.existsSync(fullPath)) {
                    const stats = fs.statSync(fullPath);
                    
                    if (stats.isDirectory()) {
                        archive.directory(fullPath, file, (entry) => {
                            // Filtrar arquivos a serem excluídos
                            return !filesToExclude.some(exclude => 
                                entry.name.includes(exclude)
                            );
                        });
                    } else {
                        archive.file(fullPath, { name: file });
                    }
                }
            }

            // Adicionar arquivo de instalação
            const currentLicense = realTimeCheck.license;
            const installInstructions = `
# WhatsApp Bot - Sistema Licenciado

## Sua Licença
- **Chave:** ${currentLicense.key?.substring(0, 8)}****
- **Válida até:** ${currentLicense.expires_formatted}
- **Dias restantes:** ${currentLicense.days_remaining}
- **Tipo:** ${currentLicense.license_type}

## Instalação
1. Extraia os arquivos
2. Execute: npm install
3. Configure o .env com suas credenciais
4. Execute: npm start
5. Acesse http://localhost:3000

## Modo de Operação
Este sistema opera em **modo tempo real**, verificando sua licença
diretamente na API a cada operação. Não armazena dados localmente.

## Suporte
Em caso de problemas, entre em contato conosco.

**Mantenha sua chave de licença em segurança!**
`;

            archive.append(installInstructions, { name: 'INSTALACAO.md' });

            // Finalizar o arquivo
            await archive.finalize();

            // Log do download
            console.log(`Download realizado - Licença: ${currentLicense.key?.substring(0, 8)}****`);

        } catch (error) {
            console.error('Erro no download:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao gerar download',
                error: error.message
            });
        }
    }

    /**
     * ⭐ TESTE DE CONEXÃO COM API
     */
    async testApiConnection(req, res) {
        try {
            const isConnected = await licenseService.testApiConnection();
            const apiStatus = await licenseService.getApiStatus();
            
            res.json({
                success: true,
                api_connected: isConnected,
                api_status: apiStatus,
                message: isConnected ? 'API conectada' : 'API desconectada',
                mode: 'real-time',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Erro ao testar API',
                error: error.message
            });
        }
    }

    /**
     * ⭐ VERIFICA MÚLTIPLAS LICENÇAS (ADMIN)
     */
    async checkMultipleLicenses(req, res) {
        try {
            const { licenses } = req.body;
            
            if (!Array.isArray(licenses) || licenses.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Array de licenças é obrigatório'
                });
            }

            const results = [];
            
            for (const licenseKey of licenses) {
                try {
                    const validation = await licenseService.validateLicense(licenseKey);
                    results.push({
                        license: licenseKey.substring(0, 8) + '****',
                        valid: validation.valid,
                        message: validation.message,
                        details: validation.license || null
                    });
                } catch (error) {
                    results.push({
                        license: licenseKey.substring(0, 8) + '****',
                        valid: false,
                        message: 'Erro na verificação: ' + error.message,
                        details: null
                    });
                }
                
                // Pequeno delay entre verificações
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            res.json({
                success: true,
                message: `Verificação concluída para ${licenses.length} licenças`,
                results: results,
                summary: {
                    total: results.length,
                    valid: results.filter(r => r.valid).length,
                    invalid: results.filter(r => !r.valid).length
                },
                mode: 'real-time',
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Erro na verificação múltipla:', error);
            res.status(500).json({
                success: false,
                message: 'Erro na verificação múltipla',
                error: error.message
            });
        }
    }

    /**
     * ⭐ ESTATÍSTICAS DO SISTEMA
     */
    async getSystemStats(req, res) {
        try {
            const currentLicense = licenseService.getCurrentLicense();
            const isValid = licenseService.isLicenseValid();
            
            // Informações do sistema
            const os = require('os');
            const process = require('process');
            
            const stats = {
                license: {
                    is_valid: isValid,
                    key: currentLicense?.key?.substring(0, 8) + '****' || 'N/A',
                    expires_at: currentLicense?.expires_at || null,
                    days_remaining: currentLicense?.days_remaining || 0,
                    last_check: currentLicense?.lastCheck || null,
                    memory_only: currentLicense?.memoryOnly || false,
                    mode: 'real-time'
                },
                system: {
                    platform: os.platform(),
                    arch: os.arch(),
                    node_version: process.version,
                    uptime: Math.round(process.uptime()),
                    memory_usage: process.memoryUsage(),
                    cpu_usage: os.loadavg()
                },
                api: {
                    base_url: licenseService.apiConfig.baseUrl,
                    timeout: licenseService.apiConfig.timeout
                },
                timestamp: new Date().toISOString()
            };

            res.json({
                success: true,
                stats: stats
            });

        } catch (error) {
            console.error('Erro ao obter estatísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Erro ao obter estatísticas',
                error: error.message
            });
        }
    }

    /**
     * ⭐ HEALTH CHECK EM TEMPO REAL
     */
    async healthCheck(req, res) {
        try {
            // ⭐ VERIFICAR LICENÇA EM TEMPO REAL
            const realTimeCheck = await licenseService.checkLocalLicense();
            const apiConnection = await licenseService.testApiConnection();
            
            const status = realTimeCheck.valid && apiConnection ? 'healthy' : 'unhealthy';
            
            res.status(status === 'healthy' ? 200 : 503).json({
                success: true,
                status: status,
                checks: {
                    license_valid: realTimeCheck.valid,
                    api_connection: apiConnection,
                    mode: 'real-time'
                },
                message: realTimeCheck.message,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            res.status(503).json({
                success: false,
                status: 'error',
                message: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
}

module.exports = new LicenseController();