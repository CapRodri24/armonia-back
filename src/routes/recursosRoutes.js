const router=require('express').Router();
const c=require('../controllers/recursosController');
const {authenticate}=require('../middleware/loginMiddleware');
router.use(authenticate);
router.get('/',c.listar);router.get('/categorias',c.categorias);router.get('/:id',c.obtener);
router.post('/',c.crear);router.put('/:id',c.actualizar);router.delete('/:id',c.eliminar);
module.exports=router;