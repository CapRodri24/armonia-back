const router = require('express').Router();
const { authenticate } = require('../middleware/loginMiddleware');
const controller = require('../controllers/dashboardController');
router.get('/', authenticate, controller.resumen);
module.exports = router;