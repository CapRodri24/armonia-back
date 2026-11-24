const router=require("express").Router();
const c=require("../controllers/nosotrosController");
const {authenticate}=require("../middleware/loginMiddleware");
router.use(authenticate);
router.get("/",c.listar);router.get("/cargos",c.cargos);router.get("/categorias",c.categorias);
router.post("/cargos",c.crearCargo);router.put("/cargos/:id",c.actualizarCargo);router.delete("/cargos/:id",c.eliminarCargo);
// "/orden" debe ir antes de "/:id" para que Express no lo tome como un id.
router.put("/orden",c.reordenar);
router.post("/",c.crear);router.put("/:id",c.actualizar);router.delete("/:id",c.eliminar);
module.exports=router;