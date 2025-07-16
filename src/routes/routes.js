const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const licenseController = require('../controllers/licenseController');

// ===== ROTAS DE TESTE ===== 
router.get('/test', (req, res) => {
    res.json({ 
        success: true, 
        message: 'API funcionando corretamente!' 
    });
});

// ===== ROTAS DE LICENÇA (LIVRES) =====
router.get('/license/status', licenseController.checkLicenseStatus);
router.post('/license/validate', licenseController.validateLicense);
router.get('/license/info', licenseController.getLicenseInfo);
router.post('/license/renew', licenseController.renewLicense);
router.post('/license/deactivate', licenseController.deactivateLicense);
router.get('/download/bot', licenseController.downloadFiles);
router.post('/license/force-check', licenseController.forceCheckLicense);
router.post('/license/clear-cache', licenseController.clearCache);
router.get('/license/debug', licenseController.debugLicense);
router.get('/license/api-test', licenseController.testApiConnection);

// ===== ROTA PARA OBTER QR CODE (LIVRE) =====
router.get('/qr', async (req, res) => {
    try {
        const whatsappService = require('../services/whatsappService');
        const currentQR = whatsappService.getCurrentQR();
        
        if (currentQR) {
            const qrcode = require('qrcode');
            const qrDataURL = await qrcode.toDataURL(currentQR);
            res.json({ 
                success: true, 
                qr: qrDataURL 
            });
        } else {
            res.json({ 
                success: false, 
                message: 'Nenhum QR Code disponível' 
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ===== ROTAS DO WHATSAPP (TODAS LIVRES) =====
router.post('/send-message', whatsappController.sendMessage);
router.post('/send-bulk', whatsappController.sendBulkMessages);
router.get('/status', whatsappController.getStatus);
router.post('/logout', whatsappController.logout);
router.get('/info', whatsappController.getInfo);

// ===== ROTAS DE GRUPOS (TODAS LIVRES) =====
router.get('/groups', whatsappController.getGroups);
router.post('/send-to-group', whatsappController.sendToGroup);
router.post('/send-to-groups', whatsappController.sendToMultipleGroups);
router.get('/group/:groupId', whatsappController.getGroupInfo);

module.exports = router;