const service = require('../services/dashboardService');
async function resumen(req, res, next) {
  try {
    const data = await service.resumen();
    res.set('Cache-Control', 'no-store');
    return res.json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
module.exports = { resumen };