const router=require('express').Router();
const c=require('../controllers/recursosController');
router.get('/',c.listar);router.get('/categorias',c.categorias);router.get('/imagenes/:id',c.imagen);router.get('/pdf/:id',c.pdf);router.get('/:id',c.obtener);
module.exports=router;