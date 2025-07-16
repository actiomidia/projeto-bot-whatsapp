const pool = require('./src/database');
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Conexão com MySQL do MAMP bem-sucedida!');
        connection.release();
    } catch (error) {
        console.error('Erro ao conectar ao MySQL:', error);
    }
}
testConnection();