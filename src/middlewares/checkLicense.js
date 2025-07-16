const licenseService = require('../services/licenseService');

module.exports = async (req, res, next) => {
    try {
        const licenseKey = req.headers['x-license-key'];
        if (!licenseKey) {
            return res.status(400).json({
                success: false,
                message: 'Chave de licença não fornecida'
            });
        }

        const validation = await licenseService.validateLicense(licenseKey);
        if (!validation.valid) {
            return res.status(403).json({
                success: false,
                message: validation.message || 'Licença inválida ou pendente'
            });
        }

        req.license = validation.license;
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Erro ao verificar licença: ' + error.message
        });
    }
};