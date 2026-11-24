const router=require("express").Router();
const c=require("../controllers/nosotrosController");
router.get("/",c.listar);router.get("/categorias",c.categorias);router.get("/imagenes/:id",c.imagen);
module.exports=router;